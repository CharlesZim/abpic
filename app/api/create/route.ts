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

// Photos are already uploaded directly to Storage by the browser; this route
// only validates the plan + the photo URLs (which must point at our public
// bucket) and records the test row. Fast, and no file bytes pass through.
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

  const seriesUrls = body.series
  if (!Array.isArray(seriesUrls) || seriesUrls.length < 1 || seriesUrls.length > MAX_SERIES) {
    return Response.json({ error: 'Un test doit avoir 1 à 5 séries.' }, { status: 400 })
  }

  // A photo URL is valid only if it's a public URL on our Supabase host for
  // the photos bucket. Parsed via URL so a trailing slash / formatting in
  // SUPABASE_URL can't cause false rejections.
  let supaHost = ''
  try {
    supaHost = new URL(process.env.SUPABASE_URL ?? '').host
  } catch {
    // leave empty -> nothing validates -> will reject below
  }
  const bucketPath = `/storage/v1/object/public/${PHOTOS_BUCKET}/`
  const isOurStorageUrl = (u: unknown): boolean => {
    if (typeof u !== 'string' || u.length > 500) return false
    try {
      const url = new URL(u)
      return url.host === supaHost && url.pathname.startsWith(bucketPath)
    } catch {
      return false
    }
  }

  const series: { id: string; images: string[] }[] = []
  for (const urls of seriesUrls) {
    if (!Array.isArray(urls) || urls.length < MIN_PHOTOS || urls.length > MAX_PHOTOS) {
      return Response.json(
        { error: 'Chaque série doit contenir 2 à 5 photos.' },
        { status: 400 }
      )
    }
    for (const u of urls) {
      if (!isOurStorageUrl(u)) {
        return Response.json({ error: 'Photo invalide.' }, { status: 400 })
      }
    }
    series.push({ id: nanoid(), images: urls as string[] })
  }

  try {
    const supabase = getSupabaseAdmin()
    const testId = nanoid()
    const resultsToken = nanoid()
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

    return Response.json({ id: testId, resultsToken })
  } catch (err) {
    console.error('[api/create] failed:', err)
    return Response.json({ error: 'Une erreur est survenue. Réessaie.' }, { status: 500 })
  }
}
