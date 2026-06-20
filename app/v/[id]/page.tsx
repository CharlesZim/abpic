import { getSupabaseAdmin } from '@/lib/supabase'

import Voter, { type Series } from './voter'

export const dynamic = 'force-dynamic'

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

function Expired() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">This test has expired</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Voting is no longer available for this link.
      </p>
    </main>
  )
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = getSupabaseAdmin()
  const { data: test } = await supabase
    .from('tests')
    .select('id, series, expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!test || isExpired(test.expires_at)) {
    return <Expired />
  }

  const series = (test.series ?? []) as Series[]
  if (series.length === 0) {
    return <Expired />
  }

  return <Voter testId={test.id} series={series} />
}
