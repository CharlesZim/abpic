import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const test_id = body?.test_id
    const series_id = body?.series_id
    const image_index = body?.image_index

    if (
      typeof test_id !== 'string' ||
      typeof series_id !== 'string' ||
      typeof image_index !== 'number' ||
      !Number.isInteger(image_index) ||
      image_index < 0
    ) {
      return Response.json({ error: 'Invalid vote' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('votes')
      .insert({ test_id, series_id, image_index })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/vote] failed:', err)
    const message =
      err instanceof Error ? err.message : 'Unexpected server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
