'use client'

import { useEffect, useRef, useState } from 'react'

export type Series = { id: string; images: string[] }

const VOTER_STORAGE_KEY = 'abpic_voter_id'

function getVoterId(): string {
  const existing = sessionStorage.getItem(VOTER_STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(VOTER_STORAGE_KEY, id)
  return id
}

function buzz(ms: number) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(ms)
}

/* ---------- icons ---------- */

function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

/* ---------- one comparable photo (tap = pick, pinch = zoom) ---------- */

function ComparePhoto({
  src,
  index,
  selected,
  faded,
  onSelect,
}: {
  src: string
  index: number
  selected: boolean
  faded: boolean
  onSelect: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const startDist = useRef(0)
  const everPinched = useRef(false)
  const moved = useRef(false)
  const startPoint = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [src])

  const pts = () => Array.from(pointers.current.values())
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)

  function setScale(scale: number, animate = false) {
    const el = imgRef.current
    if (!el) return
    el.style.transition = animate ? 'transform .25s ease' : 'none'
    el.style.transform = `scale(${scale})`
    el.style.zIndex = scale > 1 ? '30' : ''
  }

  function onDown(e: React.PointerEvent) {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      startPoint.current = { x: e.clientX, y: e.clientY }
      moved.current = false
    } else if (pointers.current.size === 2) {
      everPinched.current = true
      const [a, b] = pts()
      startDist.current = dist(a, b) || 1
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {
      const [a, b] = pts()
      setScale(Math.min(4, Math.max(1, dist(a, b) / startDist.current)))
    } else if (pointers.current.size === 1 && startPoint.current) {
      if (dist(startPoint.current, { x: e.clientX, y: e.clientY }) > 10) moved.current = true
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) setScale(1, true)
    if (pointers.current.size === 0) {
      if (!everPinched.current && !moved.current) {
        buzz(12)
        onSelect()
      }
      everPinched.current = false
      moved.current = false
      startPoint.current = null
    }
  }

  return (
    <div
      className="relative flex touch-none items-center justify-center"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        className={`relative h-full w-full overflow-hidden rounded-[28px] transition duration-200 ${
          selected ? 'ring-[3px] ring-white' : 'ring-1 ring-white/10'
        } ${faded ? 'scale-[0.97] opacity-40' : ''}`}
      >
        {!loaded && <div className="absolute inset-0 animate-pulse bg-white/10" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={`Option ${index + 1}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ pointerEvents: 'none', transformOrigin: 'center' }}
        />
        {selected && (
          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <CheckIcon />
          </span>
        )}
      </div>
    </div>
  )
}

/* ---------- main voter ---------- */

export default function Voter({ testId, series }: { testId: string; series: Series[] }) {
  const [index, setIndex] = useState(0)
  const [selections, setSelections] = useState<(number | null)[]>(() => series.map(() => null))
  const [error, setError] = useState<string | null>(null)

  async function sendVote(seriesId: string, imageIndex: number) {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: testId,
          voter_id: getVoterId(),
          series_id: seriesId,
          image_index: imageIndex,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Ton vote n’a pas pu être enregistré.')
      } else {
        setError(null)
      }
    } catch {
      setError('Connexion impossible — vérifie ta connexion.')
    }
  }

  function select(imageIndex: number) {
    setSelections((prev) => {
      const next = [...prev]
      next[index] = imageIndex
      return next
    })
  }

  function next() {
    const choice = selections[index]
    if (choice === null) return
    buzz(20)
    sendVote(series[index].id, choice)
    setIndex((i) => i + 1)
  }

  function back() {
    buzz(8)
    setIndex((i) => Math.max(0, i - 1))
  }

  if (index >= series.length) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-black text-white"
        style={{ padding: 'env(safe-area-inset-top) 1.5rem env(safe-area-inset-bottom)' }}
      >
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-60 motion-safe:animate-ping" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600">
            <CheckIcon size={44} />
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Merci, c’est voté !</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  const current = series[index]
  const selected = selections[index]
  const isLast = index === series.length - 1

  return (
    <div
      className="fixed inset-0 flex select-none flex-col bg-black text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* story-style progress */}
      <div className="flex gap-1.5 px-3 pt-3">
        {series.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className={`h-full rounded-full bg-white transition-all duration-300 ${
                i <= index ? 'w-full' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      {/* back + context */}
      <div className="flex items-center gap-3 px-3 pb-1 pt-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={back}
            aria-label="Précédent"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-90"
          >
            <ChevronLeftIcon />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <p className="text-[13px] font-medium text-white/55">
          Tape ta préférée · pince pour zoomer
        </p>
      </div>

      {/* photos */}
      <div
        className="grid min-h-0 flex-1 gap-2.5 p-2.5"
        style={{ gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr' }}
      >
        {current.images.map((src, imageIndex) => (
          <ComparePhoto
            key={imageIndex}
            src={src}
            index={imageIndex}
            selected={selected === imageIndex}
            faded={selected !== null && selected !== imageIndex}
            onSelect={() => select(imageIndex)}
          />
        ))}
      </div>

      {error && (
        <p className="mx-4 mb-1 rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      {/* CTA */}
      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={next}
          disabled={selected === null}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-bold transition active:scale-[0.98] ${
            selected === null
              ? 'bg-white/10 text-white/40'
              : 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25'
          }`}
        >
          {selected === null ? 'Choisis ta préférée' : isLast ? 'Terminer' : 'Suivant'}
          {selected !== null && <ArrowRightIcon />}
        </button>
      </div>
    </div>
  )
}
