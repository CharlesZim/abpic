import { nanoid } from 'nanoid'

import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const DURATION_HOURS: Record<string, number> = {
  '1h': 1,
  '3h': 3,
  '6h': 6,
  '12h': 12,
  '24h': 24,
}

const PHOTOS_BUCKET = 'photos'

const MAX_SERIES = 5
const MAX_PHOTOS_PER_SERIES = 5
const MIN_PHOTOS_PER_SERIES = 2
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB per photo
const MAX_TOTAL_BYTES = 40 * 1024 * 1024 // 40 MB per request

// Allowlist of image types we accept, mapped to their canonical extension.
// SVG is intentionally excluded (it can carry script).
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Detect the real image type from magic bytes, ignoring the client-supplied
// MIME (which is untrusted). Returns null for anything not on the allowlist.
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

type ValidatedFile = { file: File; mime: string; ext: string }

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Format invalide.' }, { status: 400 })
  }

  const duration = String(formData.get('duration') ?? '')
  const hours = DURATION_HOURS[duration]
  if (!hours) {
    return Response.json({ error: 'Durée invalide.' }, { status: 400 })
  }

  const creatorName = String(formData.get('name') ?? '').trim().slice(0, 40) || null

  let seriesOrder: string[]
  try {
    seriesOrder = JSON.parse(String(formData.get('seriesOrder') ?? ''))
  } catch {
    return Response.json({ error: 'Données invalides.' }, { status: 400 })
  }

  if (
    !Array.isArray(seriesOrder) ||
    seriesOrder.length < 1 ||
    seriesOrder.length > MAX_SERIES ||
    !seriesOrder.every((id) => typeof id === 'string')
  ) {
    return Response.json({ error: 'Un test doit avoir 1 à 5 séries.' }, { status: 400 })
  }

  // Collect, validate, and content-sniff every photo up front so we reject
  // bad input before touching storage. The client series id is only used to
  // group the form fields here; the stored/path id is generated server-side.
  const collected: ValidatedFile[][] = []
  let totalBytes = 0
  for (const clientId of seriesOrder) {
    const files = formData
      .getAll(`series_${clientId}`)
      .filter((entry): entry is File => entry instanceof File)

    if (files.length < MIN_PHOTOS_PER_SERIES || files.length > MAX_PHOTOS_PER_SERIES) {
      return Response.json(
        { error: 'Chaque série doit contenir 2 à 5 photos.' },
        { status: 400 }
      )
    }

    const validated: ValidatedFile[] = []
    for (const file of files) {
      if (file.size === 0 || file.size > MAX_FILE_BYTES) {
        return Response.json(
          { error: 'Chaque photo doit faire moins de 8 Mo.' },
          { status: 400 }
        )
      }
      totalBytes += file.size
      if (totalBytes > MAX_TOTAL_BYTES) {
        return Response.json({ error: 'L’envoi total est trop volumineux.' }, { status: 400 })
      }

      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
      const mime = sniffImageType(head)
      if (!mime) {
        return Response.json(
          { error: 'Les photos doivent être en JPEG, PNG, WebP ou GIF.' },
          { status: 400 }
        )
      }
      validated.push({ file, mime, ext: ALLOWED_TYPES[mime] })
    }
    collected.push(validated)
  }

  try {
    const supabase = getSupabaseAdmin()
    const testId = nanoid()
    const resultsToken = nanoid()

    // Server-generated, path-safe series ids.
    const seriesMeta = collected.map((files) => ({ seriesId: nanoid(), files }))

    // Upload every photo in parallel instead of one-by-one (the previous
    // sequential loop was the main source of slowness on submit).
    const uploads = seriesMeta.flatMap(({ seriesId, files }) =>
      files.map((vf, index) =>
        supabase.storage
          .from(PHOTOS_BUCKET)
          .upload(`${testId}/${seriesId}/${index}.${vf.ext}`, vf.file, {
            contentType: vf.mime,
            upsert: false,
          })
      )
    )

    const uploadResults = await Promise.all(uploads)
    const failed = uploadResults.find((r) => r.error)
    if (failed?.error) {
      console.error('[api/create] upload failed:', failed.error)
      return Response.json(
        { error: 'L’envoi des photos a échoué. Réessaie.' },
        { status: 500 }
      )
    }

    const series = seriesMeta.map(({ seriesId, files }) => ({
      id: seriesId,
      images: files.map(
        (vf, index) =>
          supabase.storage
            .from(PHOTOS_BUCKET)
            .getPublicUrl(`${testId}/${seriesId}/${index}.${vf.ext}`).data
            .publicUrl
      ),
    }))

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from('tests').insert({
      id: testId,
      series,
      expires_at: expiresAt,
      results_token: resultsToken,
      creator_name: creatorName,
    })

    if (insertError) {
      console.error('[api/create] insert failed:', insertError)
      return Response.json(
        { error: 'Impossible de créer le test. Réessaie.' },
        { status: 500 }
      )
    }

    return Response.json({ id: testId, resultsToken })
  } catch (err) {
    console.error('[api/create] failed:', err)
    return Response.json({ error: 'Une erreur est survenue. Réessaie.' }, { status: 500 })
  }
}
