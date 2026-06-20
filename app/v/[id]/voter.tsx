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

function CheckIcon({ size = 20 }: { size?: number }) {
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

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ---------- fullscreen pinch-to-zoom viewer ---------- */

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
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)

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
      view.current.scale = Math.min(5, Math.max(1, pinch.current.scale * (dist(a, b) / pinch.current.dist)))
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex justify-end p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full bg-white/15 p-2 text-white active:scale-90">
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
          style={{ transformOrigin: 'center', pointerEvents: 'none' }}
        />
      </div>
      <p className="pb-6 pt-2 text-center text-xs text-white/50">Pince pour zoomer · tape pour fermer</p>
    </div>
  )
}

/* ---------- one swipe slide ---------- */

function PhotoSlide({ src, number, onOpen }: { src: string; number: number; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [src])

  return (
    <div className="flex h-full shrink-0 basis-full snap-center items-center justify-center p-3">
      <button type="button" onClick={onOpen} className="relative flex h-full w-full items-center justify-center">
        {!loaded && <div className="absolute inset-8 animate-pulse rounded-3xl bg-white/10" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={`Photo ${number}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`max-h-full max-w-full rounded-3xl object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        <span className="pointer-events-none absolute left-4 top-4 flex h-9 min-w-9 items-center justify-center rounded-full bg-black/55 px-2.5 text-base font-bold text-white backdrop-blur">
          {number}
        </span>
      </button>
    </div>
  )
}

/* ---------- main voter ---------- */

export default function Voter({ testId, series }: { testId: string; series: Series[] }) {
  const [index, setIndex] = useState(0)
  const [photo, setPhoto] = useState(0)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

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

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== photo) setPhoto(i)
  }

  function goToPhoto(i: number) {
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function choose() {
    buzz(20)
    sendVote(series[index].id, photo)
    setPhoto(0)
    setIndex((i) => i + 1)
  }

  function back() {
    buzz(8)
    setPhoto(0)
    setIndex((i) => Math.max(0, i - 1))
  }

  if (index >= series.length) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-black px-6 text-white">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-60 motion-safe:animate-ping" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600">
            <CheckIcon size={46} />
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Merci, c’est voté !</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  const current = series[index]

  return (
    <div
      className="fixed inset-0 flex select-none flex-col bg-black text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* story progress */}
      <div className="flex gap-1.5 px-3 pt-3">
        {series.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      {/* back + context */}
      <div className="flex items-center gap-3 px-3 pb-1 pt-3">
        {index > 0 ? (
          <button type="button" onClick={back} aria-label="Précédent" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-90">
            <ChevronLeftIcon />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <p className="text-[13px] font-medium text-white/55">Swipe pour comparer · tape pour agrandir</p>
      </div>

      {/* swipeable photos */}
      <div
        ref={scrollerRef}
        key={`series-${index}`}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {current.images.map((src, i) => (
          <PhotoSlide key={i} src={src} number={i + 1} onOpen={() => setZoomSrc(src)} />
        ))}
      </div>

      {/* dots */}
      {current.images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5">
          {current.images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={() => goToPhoto(i)}
              className={`h-2 rounded-full transition-all ${i === photo ? 'w-6 bg-white' : 'w-2 bg-white/35'}`}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mx-4 mb-1 rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm text-red-300">{error}</p>
      )}

      {/* choose */}
      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={choose}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
        >
          <CheckIcon /> Choisir la photo {photo + 1}
        </button>
      </div>

      {zoomSrc && <ZoomModal src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  )
}
