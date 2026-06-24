import type { Metadata } from 'next'

import { Wordmark } from '@/app/_components/wordmark'
import { getSupabaseAdmin } from '@/lib/supabase'

import Voter, { type Series } from './voter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '👀 Aide-moi à choisir ma photo',
  description: 'Tape ta préférée, ça prend 10 secondes.',
  openGraph: {
    title: '👀 Aide-moi à choisir ma photo',
    description: 'Tape ta préférée, ça prend 10 secondes.',
  },
  twitter: {
    title: '👀 Aide-moi à choisir ma photo',
    description: 'Tape ta préférée, ça prend 10 secondes.',
  },
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

function Expired() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-white">
      <Wordmark href="/" className="absolute top-5 text-lg" />
      <div className="text-4xl">⌛️</div>
      <h1 className="text-2xl font-bold">Ce test a expiré</h1>
      <p className="text-sm text-zinc-400">Le vote n’est plus disponible pour ce lien.</p>
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
    .select('id, series, expires_at, creator_name')
    .eq('id', id)
    .maybeSingle()

  if (!test || isExpired(test.expires_at)) {
    return <Expired />
  }

  const series = (test.series ?? []) as Series[]
  if (series.length === 0) {
    return <Expired />
  }

  return <Voter testId={test.id} series={series} creatorName={test.creator_name ?? null} />
}
