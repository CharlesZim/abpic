'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Wordmark } from '@/app/_components/wordmark'

export type Series = { id: string; images: string[] }

const VOTER_STORAGE_KEY = 'abpic_voter_id'

function getVoterId(): string {
  // localStorage persists across tabs/reopens (unlike sessionStorage), so the
  // same browser keeps one identity -> one vote per series.
  try {
    const existing = localStorage.getItem(VOTER_STORAGE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(VOTER_STORAGE_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
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

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ---------- fullscreen pinch-to-zoom (neutral background) ---------- */

function ZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
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

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const pts = () => Array.from(pointers.current.values())
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

  function onDown(e: React.PointerEvent) {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = pts()
      pinch.current = { dist: dist(a, b) || 1, scale: view.current.scale }
      pan.current = null
    } else if (pointers.current.size === 1) {
      pan.current = { x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty }
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = pts()
      const ratio = dist(a, b) / pinch.current.dist
      view.current.scale = Math.min(5, Math.max(1, pinch.current.scale * (1 + (ratio - 1) * 0.7)))
      apply()
    } else if (pointers.current.size === 1 && pan.current && view.current.scale > 1) {
      view.current.tx = pan.current.tx + (e.clientX - pan.current.x)
      view.current.ty = pan.current.ty + (e.clientY - pan.current.y)
      apply()
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    pinch.current = null
    pan.current = null
    if (view.current.scale <= 1) {
      view.current = { scale: 1, tx: 0, ty: 0 }
      const el = imgRef.current
      if (el) {
        el.style.transition = 'transform .25s ease'
        apply()
        setTimeout(() => el && (el.style.transition = 'none'), 260)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex justify-end p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full bg-white/10 p-2 text-white active:scale-90">
          <CloseIcon />
        </button>
      </div>
      <div
        className="flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => {
          view.current = view.current.scale > 1 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2.5, tx: 0, ty: 0 }
          apply()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain will-change-transform"
          style={{ transformOrigin: 'center', pointerEvents: 'none', imageOrientation: 'from-image' }}
        />
      </div>
      <p className="pb-6 pt-2 text-center text-xs text-white/45">Pince pour zoomer</p>
    </div>
  )
}

/* ---------- big focused photo (tap to zoom) ---------- */

function MainPhoto({ src, onZoom }: { src: string; onZoom: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [src])

  return (
    <button
      type="button"
      onClick={onZoom}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-zinc-900"
    >
      {!loaded && <div className="absolute inset-8 animate-pulse rounded-2xl bg-white/10" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt="Photo"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ imageOrientation: 'from-image' }}
      />
      <span className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur">
        <ExpandIcon />
      </span>
    </button>
  )
}

/* ---------- main voter ---------- */

export default function Voter({
  testId,
  series,
  creatorName,
}: {
  testId: string
  series: Series[]
  creatorName: string | null
}) {
  const [index, setIndex] = useState(0)
  const [current, setCurrent] = useState(0)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
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

  function choose() {
    buzz(18)
    sendVote(series[index].id, current)
    setCurrent(0)
    setIndex((i) => i + 1)
  }

  function back() {
    buzz(8)
    setCurrent(0)
    setIndex((i) => Math.max(0, i - 1))
  }

  if (index >= series.length) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 px-6 text-center text-white">
        <Wordmark href="/" className="absolute top-5 text-lg" />
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-60 motion-safe:animate-ping" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600">
            <CheckIcon size={46} />
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Merci, c’est voté !</h1>
        <p className="text-sm text-white/55">Toi aussi, demande à tes amis 👇</p>
        <Link
          href="/"
          className="mt-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
        >
          Fais le tien
        </Link>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </main>
    )
  }

  const serie = series[index]
  const context = creatorName
    ? `${creatorName} poste laquelle ? Tape ta préférée 👇`
    : 'Tu choisis laquelle ? Tape ta préférée 👇'

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 sm:max-w-2xl">
        <header className="space-y-3 pb-3 pt-5">
          <div className="flex items-center justify-between">
            <Wordmark href="/" className="text-lg" />
            <Link
              href="/"
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow shadow-fuchsia-500/20 active:scale-95"
            >
              Fais le tien
            </Link>
          </div>
          {series.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1.5">
                {series.map((s, i) => (
                  <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                    <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} />
                  </div>
                ))}
              </div>
              <span className="text-xs font-medium text-white/40">
                {index + 1}/{series.length}
              </span>
            </div>
          )}
          <p className="text-sm text-white/60">{context}</p>
        </header>

        {/* big focused photo */}
        <div className="relative min-h-0 flex-1">
          <MainPhoto key={`${index}:${current}`} src={serie.images[current]} onZoom={() => setZoomSrc(serie.images[current])} />
        </div>

        {/* thumbnail strip */}
        <div className="flex justify-center gap-2 overflow-x-auto py-3">
          {serie.images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === current ? 'border-fuchsia-500' : 'border-white/10 opacity-70'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                style={{ imageOrientation: 'from-image' }}
              />
              <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black/55 px-1 text-[10px] font-bold">
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-white/10 bg-zinc-950/85 backdrop-blur"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3 sm:max-w-2xl">
          {error && <p className="mb-2 text-center text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                aria-label="Précédent"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/15 text-white active:scale-95"
              >
                <ChevronLeftIcon />
              </button>
            )}
            <button
              type="button"
              onClick={choose}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
            >
              Choisir la photo {current + 1}
            </button>
          </div>
        </div>
      </div>

      {zoomSrc && <ZoomModal src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </main>
  )
}
