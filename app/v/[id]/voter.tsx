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

/* ---------- icons ---------- */

function ZoomIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ---------- fullscreen pinch-to-zoom viewer ---------- */

function ZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const view = useRef({ scale: 1, tx: 0, ty: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  function apply() {
    const el = imgRef.current
    if (el) {
      const { scale, tx, ty } = view.current
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    }
  }

  function reset() {
    view.current = { scale: 1, tx: 0, ty: 0 }
    apply()
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const points = () => Array.from(pointers.current.values())
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = points()
      pinch.current = { dist: distance(a, b), scale: view.current.scale }
      pan.current = null
    } else if (pointers.current.size === 1) {
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        tx: view.current.tx,
        ty: view.current.ty,
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = points()
      const next = pinch.current.scale * (distance(a, b) / pinch.current.dist)
      view.current.scale = Math.min(5, Math.max(1, next))
      apply()
    } else if (pointers.current.size === 1 && pan.current && view.current.scale > 1) {
      view.current.tx = pan.current.tx + (e.clientX - pan.current.x)
      view.current.ty = pan.current.ty + (e.clientY - pan.current.y)
      apply()
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    pinch.current = null
    pan.current = null
    if (view.current.scale <= 1) reset()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex justify-end p-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-full bg-white/15 p-2 text-white active:scale-95"
        >
          <CloseIcon />
        </button>
      </div>
      <div
        className="flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          view.current = view.current.scale > 1 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2.5, tx: 0, ty: 0 }
          apply()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain will-change-transform"
          style={{ transformOrigin: 'center center', pointerEvents: 'none' }}
        />
      </div>
      <p className="pb-6 pt-2 text-center text-xs text-white/60">
        Pince pour zoomer · double-tape pour réinitialiser
      </p>
    </div>
  )
}

/* ---------- single comparable photo ---------- */

function Photo({
  src,
  index,
  selected,
  onSelect,
  onZoom,
}: {
  src: string
  index: number
  selected: boolean
  onSelect: () => void
  onZoom: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [src])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`block w-full overflow-hidden rounded-2xl border-2 transition ${
          selected
            ? 'border-blue-600 ring-2 ring-blue-600/30'
            : 'border-zinc-200 dark:border-zinc-700'
        }`}
      >
        <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-900">
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={`Option ${index + 1}`}
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {selected && (
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow">
              <CheckIcon />
            </span>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onZoom}
        aria-label="Agrandir la photo"
        className="absolute left-2 top-2 rounded-full bg-black/55 p-2 text-white backdrop-blur active:scale-95"
      >
        <ZoomIcon />
      </button>
    </div>
  )
}

/* ---------- main voter ---------- */

export default function Voter({
  testId,
  series,
}: {
  testId: string
  series: Series[]
}) {
  const [index, setIndex] = useState(0)
  const [selections, setSelections] = useState<(number | null)[]>(() =>
    series.map(() => null)
  )
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
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

  function valider() {
    const choice = selections[index]
    if (choice === null) return
    sendVote(series[index].id, choice)
    setIndex((i) => i + 1)
  }

  function precedent() {
    setIndex((i) => Math.max(0, i - 1))
  }

  if (index >= series.length) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold">Merci, c’est voté !</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </main>
    )
  }

  const current = series[index]
  const selected = selections[index]
  const gridCols =
    current.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
  const progress = ((index + 1) / series.length) * 100

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 px-5 pb-3 pt-4 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>
            Série {index + 1} / {series.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Aide à choisir — tape ta préférée dans chaque série.
        </p>
      </header>

      <main className="flex-1 px-5 py-5">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950">
            {error}
          </p>
        )}
        <div className={`grid gap-3 ${gridCols}`}>
          {current.images.map((src, imageIndex) => (
            <Photo
              key={imageIndex}
              src={src}
              index={imageIndex}
              selected={selected === imageIndex}
              onSelect={() => select(imageIndex)}
              onZoom={() => setZoom({ src, alt: `Option ${imageIndex + 1}` })}
            />
          ))}
        </div>
      </main>

      <footer className="sticky bottom-0 flex gap-3 border-t border-zinc-200 bg-white/85 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <button
          type="button"
          onClick={precedent}
          disabled={index === 0}
          className="rounded-xl border border-zinc-300 px-5 py-3 font-medium disabled:opacity-40 dark:border-zinc-600"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={valider}
          disabled={selected === null}
          className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-40"
        >
          Valider
        </button>
      </footer>

      {zoom && (
        <ZoomModal src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />
      )}
    </div>
  )
}
