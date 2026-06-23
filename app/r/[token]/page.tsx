import { Wordmark } from '@/app/_components/wordmark'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Series = { id: string; images: string[] }
type VoteRow = { series_id: string; image_index: number }

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-white">
      <Wordmark className="absolute top-5 text-lg" />
      <h1 className="text-2xl font-bold">Résultats introuvables</h1>
      <p className="text-sm text-zinc-400">Ce lien de résultats n’est pas valide.</p>
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
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-md px-5 py-6 sm:max-w-2xl">
        <header className="mb-6 space-y-3">
          <Wordmark className="text-lg" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Résultats</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {expired ? 'Le vote est terminé.' : 'Le vote est en cours…'}
            </p>
          </div>
        </header>

        <div className="space-y-5">
          {series.map((s, seriesIndex) => {
            const counts = tally.get(s.id) ?? []
            const total = counts.reduce((sum, n) => sum + n, 0)
            const maxCount = Math.max(0, ...counts)

            return (
              <section
                key={s.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold">
                    {series.length > 1 ? `Série ${seriesIndex + 1}` : 'Tes photos'}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {total === 0
                      ? 'Encore aucun vote'
                      : `${total} ${total === 1 ? 'vote' : 'votes'}`}
                  </span>
                </div>

                <div className={`grid gap-3 ${s.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {s.images.map((src, imageIndex) => {
                    const count = counts[imageIndex] ?? 0
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                    const isWinner = total > 0 && count === maxCount

                    return (
                      <div key={imageIndex} className="flex flex-col gap-1.5">
                        <div
                          className={`relative aspect-[3/4] overflow-hidden rounded-2xl border-2 bg-zinc-900 ${
                            isWinner ? 'border-fuchsia-500' : 'border-white/10'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Photo ${imageIndex + 1}`}
                            className="absolute inset-0 h-full w-full object-contain"
                            style={{ imageOrientation: 'from-image' }}
                          />
                          {isWinner && (
                            <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-2.5 py-0.5 text-xs font-bold text-white shadow">
                              Gagnante
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-bold">{pct}%</span>
                          <span className="text-zinc-500">
                            {count} {count === 1 ? 'vote' : 'votes'}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
