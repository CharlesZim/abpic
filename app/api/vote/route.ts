import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

type Series = { id: string; images: string[] }

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

    // Verify the vote refers to a real, non-expired test and a real photo.
    const { data: test } = await supabase
      .from('tests')
      .select('series, expires_at')
      .eq('id', test_id)
      .maybeSingle()

    if (!test) {
      return Response.json({ error: 'Test not found' }, { status: 404 })
    }
    if (new Date(test.expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'This test has ended' }, { status: 403 })
    }

    const series = (test.series ?? []) as Series[]
    const target = series.find((s) => s.id === series_id)
    if (!target || image_index >= target.images.length) {
      return Response.json({ error: 'Invalid vote' }, { status: 400 })
    }

    const { error } = await supabase
      .from('votes')
      .insert({ test_id, series_id, image_index })

    if (error) {
      console.error('[api/vote] insert failed:', error)
      return Response.json(
        { error: 'Could not record your vote.' },
        { status: 500 }
      )
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/vote] failed:', err)
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
