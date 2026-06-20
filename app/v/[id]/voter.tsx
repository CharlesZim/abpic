'use client'

import { useState } from 'react'

export type Series = { id: string; images: string[] }

export default function Voter({
  testId,
  series,
}: {
  testId: string
  series: Series[]
}) {
  const [index, setIndex] = useState(0)
  const [voteError, setVoteError] = useState<string | null>(null)

  async function vote(seriesId: string, imageIndex: number) {
    // Advance instantly (optimistic); surface failures in a banner instead of
    // silently dropping votes so a misconfigured `votes` table is visible.
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: testId,
          series_id: seriesId,
          image_index: imageIndex,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setVoteError(data?.error || `Vote failed (${res.status})`)
      }
    } catch {
      setVoteError('Vote failed — check your connection.')
    }
  }

  function handleTap(imageIndex: number) {
    const current = series[index]
    vote(current.id, imageIndex)
    setIndex((i) => i + 1)
  }

  if (index >= series.length) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold">Thanks for voting!</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your responses have been recorded.
        </p>
        {voteError && (
          <p className="text-sm text-red-600">
            Some votes may not have been saved: {voteError}
          </p>
        )}
      </main>
    )
  }

  const current = series[index]

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Series {index + 1} of {series.length}
        </p>
        <h1 className="text-xl font-bold">Tap your favorite</h1>
      </header>

      {voteError && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950">
          {voteError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {current.images.map((src, imageIndex) => (
          <button
            key={imageIndex}
            type="button"
            onClick={() => handleTap(imageIndex)}
            className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 active:scale-[0.98] dark:border-zinc-700"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Option ${imageIndex + 1}`}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </main>
  )
}
