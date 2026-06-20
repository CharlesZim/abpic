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

function extFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  const subtype = file.type.split('/')[1]?.toLowerCase()
  if (subtype === 'jpeg') return 'jpg'
  return subtype || 'jpg'
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const duration = String(formData.get('duration') ?? '')
  const hours = DURATION_HOURS[duration]
  if (!hours) {
    return Response.json({ error: 'Invalid duration' }, { status: 400 })
  }

  let seriesOrder: string[]
  try {
    seriesOrder = JSON.parse(String(formData.get('seriesOrder') ?? ''))
  } catch {
    return Response.json({ error: 'Invalid seriesOrder' }, { status: 400 })
  }

  if (!Array.isArray(seriesOrder) || seriesOrder.length < 1 || seriesOrder.length > 5) {
    return Response.json({ error: 'A test must have 1 to 5 series' }, { status: 400 })
  }

  // Collect and validate the photos per series up front so we fail before uploading anything.
  const collected: { id: string; files: File[] }[] = []
  for (const id of seriesOrder) {
    const files = formData
      .getAll(`series_${id}`)
      .filter((entry): entry is File => entry instanceof File)

    if (files.length < 2 || files.length > 5) {
      return Response.json(
        { error: 'Each series must have 2 to 5 photos' },
        { status: 400 }
      )
    }
    collected.push({ id, files })
  }

  try {
    const supabase = getSupabaseAdmin()
    const testId = nanoid()

    const series: { id: string; images: string[] }[] = []
    for (const { id, files } of collected) {
      const images: string[] = []
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        const path = `${testId}/${id}/${index}.${extFor(file)}`

        const { error: uploadError } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .upload(path, file, {
            contentType: file.type || 'image/jpeg',
            upsert: true,
          })

        if (uploadError) {
          return Response.json(
            { error: `Upload failed: ${uploadError.message}` },
            { status: 500 }
          )
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
        images.push(publicUrl)
      }
      series.push({ id, images })
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('tests')
      .insert({ id: testId, series, expires_at: expiresAt })

    if (insertError) {
      return Response.json(
        { error: `Could not create test: ${insertError.message}` },
        { status: 500 }
      )
    }

    return Response.json({ id: testId })
  } catch (err) {
    console.error('[api/create] failed:', err)
    const message =
      err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
