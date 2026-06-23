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
const MIN_PHOTOS = 2
const MAX_PHOTOS = 5

// The browser uploads each (already-compressed, JPEG) photo directly to
// Supabase Storage using these signed URLs, so large uploads never hit the
// Vercel function body limit. This route only validates the plan, hands back
// upload slots, and records the test row.
export async function POST(request: Request) {
  let body: { duration?: unknown; name?: unknown; series?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Format invalide.' }, { status: 400 })
  }

  const duration = String(body.duration ?? '')
  const hours = DURATION_HOURS[duration]
  if (!hours) {
    return Response.json({ error: 'Durée invalide.' }, { status: 400 })
  }

  const creatorName =
    (typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '') || null

  const counts = body.series
  if (!Array.isArray(counts) || counts.length < 1 || counts.length > MAX_SERIES) {
    return Response.json({ error: 'Un test doit avoir 1 à 5 séries.' }, { status: 400 })
  }
  for (const c of counts) {
    if (!Number.isInteger(c) || c < MIN_PHOTOS || c > MAX_PHOTOS) {
      return Response.json(
        { error: 'Chaque série doit contenir 2 à 5 photos.' },
        { status: 400 }
      )
    }
  }

  try {
    const supabase = getSupabaseAdmin()
    const testId = nanoid()
    const resultsToken = nanoid()

    const slots: { path: string; token: string }[] = []
    const series: { id: string; images: string[] }[] = []

    for (const count of counts as number[]) {
      const seriesId = nanoid()
      const images: string[] = []
      for (let i = 0; i < count; i++) {
        const path = `${testId}/${seriesId}/${i}.jpg`
        const { data: signed, error } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .createSignedUploadUrl(path)
        if (error || !signed) {
          console.error('[api/create] sign failed:', error)
          return Response.json(
            { error: 'Préparation de l’envoi impossible. Réessaie.' },
            { status: 500 }
          )
        }
        slots.push({ path, token: signed.token })
        images.push(supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl)
      }
      series.push({ id: seriesId, images })
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    const baseRow = { id: testId, series, expires_at: expiresAt, results_token: resultsToken }

    let { error: insertError } = await supabase
      .from('tests')
      .insert({ ...baseRow, creator_name: creatorName })

    // Fall back if the optional creator_name column doesn't exist yet.
    if (insertError) {
      console.error('[api/create] insert failed (retry without creator_name):', insertError)
      ;({ error: insertError } = await supabase.from('tests').insert(baseRow))
    }

    if (insertError) {
      console.error('[api/create] insert failed:', insertError)
      return Response.json({ error: 'Impossible de créer le test. Réessaie.' }, { status: 500 })
    }

    return Response.json({ id: testId, resultsToken, slots })
  } catch (err) {
    console.error('[api/create] failed:', err)
    return Response.json({ error: 'Une erreur est survenue. Réessaie.' }, { status: 500 })
  }
}
