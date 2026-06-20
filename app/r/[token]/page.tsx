import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Series = { id: string; images: string[] }
type VoteRow = { series_id: string; image_index: number }

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Results not found</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This results link is invalid.
      </p>
    </main>
  )
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = getSupabaseAdmin()
  // Results are gated by a separate secret token, not the public voting id.
  const { data: test } = await supabase
    .from('tests')
    .select('id, series, expires_at')
    .eq('results_token', token)
    .maybeSingle()

  if (!test) {
    return <NotFound />
  }

  const series = (test.series ?? []) as Series[]
  const expired = isExpired(test.expires_at)

  const { data: votes } = await supabase
    .from('votes')
    .select('series_id, image_index')
    .eq('test_id', test.id)

  // Tally votes per series -> per image index.
  const tally = new Map<string, number[]>()
  for (const s of series) tally.set(s.id, new Array(s.images.length).fill(0))
  for (const v of (votes ?? []) as VoteRow[]) {
    const counts = tally.get(v.series_id)
    if (counts && v.image_index >= 0 && v.image_index < counts.length) {
      counts[v.image_index] += 1
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {expired ? 'This test has ended.' : 'This test is still collecting votes.'}
        </p>
      </header>

      {series.map((s, seriesIndex) => {
        const counts = tally.get(s.id) ?? []
        const total = counts.reduce((sum, n) => sum + n, 0)
        const maxCount = Math.max(0, ...counts)

        return (
          <section
            key={s.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Series {seriesIndex + 1}</h2>
              <span className="text-xs text-zinc-500">
                {total} {total === 1 ? 'vote' : 'votes'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {s.images.map((src, imageIndex) => {
                const count = counts[imageIndex] ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const isWinner = total > 0 && count === maxCount

                return (
                  <div key={imageIndex} className="flex flex-col gap-1">
                    <div
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                        isWinner
                          ? 'border-green-500'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Option ${imageIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {isWinner && (
                        <span className="absolute left-1 top-1 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{pct}%</span>
                      <span className="text-zinc-500">
                        {count} {count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}
