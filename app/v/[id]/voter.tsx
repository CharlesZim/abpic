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

/* ---------- one slide ---------- */

function Slide({
  src,
  number,
  imgRef,
}: {
  src: string
  number: number
  imgRef: (el: HTMLImageElement | null) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const localRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (localRef.current?.complete) setLoaded(true)
  }, [src])

  return (
    <div className="relative flex h-full w-full shrink-0 items-center justify-center">
      {!loaded && <div className="absolute inset-6 animate-pulse rounded-2xl bg-white/10" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(el) => {
          localRef.current = el
          imgRef(el)
        }}
        src={src}
        alt={`Photo ${number}`}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none', transformOrigin: 'center', willChange: 'transform' }}
      />
    </div>
  )
}

/* ---------- gesture carousel: swipe to navigate, pinch to zoom ---------- */

function Carousel({ images, onPhotoChange }: { images: string[]; onPhotoChange: (i: number) => void }) {
  const [idx, setIdx] = useState(0)
  const idxRef = useRef(0) // kept in sync inside the gesture handlers below

  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const imgRefs = useRef<Array<HTMLImageElement | null>>([])
  const widthRef = useRef(0)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const everPinched = useRef(false)
  const swipe = useRef({ startX: 0, dx: 0 })
  const pinch = useRef({ dist: 0, scale: 1, midX: 0, midY: 0, tx: 0, ty: 0 })
  const pan = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const zoom = useRef({ scale: 1, tx: 0, ty: 0 })

  const width = () => widthRef.current || viewportRef.current?.clientWidth || 1
  const pts = () => Array.from(pointers.current.values())
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  function applyTrack(animate = false) {
    const el = trackRef.current
    if (!el) return
    el.style.transition = animate ? 'transform .34s cubic-bezier(.25,.46,.45,.94)' : 'none'
    el.style.transform = `translateX(${-(idxRef.current * width()) + swipe.current.dx}px)`
  }

  function applyZoom(animate = false) {
    const el = imgRefs.current[idxRef.current]
    if (!el) return
    el.style.transition = animate ? 'transform .25s ease' : 'none'
    el.style.transform = `translate(${zoom.current.tx}px, ${zoom.current.ty}px) scale(${zoom.current.scale})`
    el.style.zIndex = zoom.current.scale > 1 ? '20' : '0'
  }

  function resetZoom() {
    zoom.current = { scale: 1, tx: 0, ty: 0 }
    applyZoom(true)
  }

  function onDown(e: React.PointerEvent) {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 0) widthRef.current = viewportRef.current?.clientWidth || 0
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      everPinched.current = true
      const [a, b] = pts()
      const m = mid(a, b)
      pinch.current = { dist: dist(a, b) || 1, scale: zoom.current.scale, midX: m.x, midY: m.y, tx: zoom.current.tx, ty: zoom.current.ty }
      swipe.current.dx = 0
      applyTrack(true)
    } else if (pointers.current.size === 1) {
      const p = pts()[0]
      if (zoom.current.scale > 1) {
        pan.current = { x: p.x, y: p.y, tx: zoom.current.tx, ty: zoom.current.ty }
      } else {
        swipe.current = { startX: p.x, dx: 0 }
      }
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = pts()
      const m = mid(a, b)
      zoom.current.scale = Math.min(4, Math.max(1, pinch.current.scale * (dist(a, b) / pinch.current.dist)))
      zoom.current.tx = pinch.current.tx + (m.x - pinch.current.midX)
      zoom.current.ty = pinch.current.ty + (m.y - pinch.current.midY)
      applyZoom()
    } else if (pointers.current.size === 1) {
      const p = pts()[0]
      if (zoom.current.scale > 1) {
        zoom.current.tx = pan.current.tx + (p.x - pan.current.x)
        zoom.current.ty = pan.current.ty + (p.y - pan.current.y)
        applyZoom()
      } else if (!everPinched.current) {
        let dx = p.x - swipe.current.startX
        const atStart = idxRef.current === 0 && dx > 0
        const atEnd = idxRef.current === images.length - 1 && dx < 0
        if (atStart || atEnd) dx *= 0.3 // rubber-band at the edges
        else dx *= 0.85 // a touch of damping so it feels less twitchy
        swipe.current.dx = dx
        applyTrack(false)
      }
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)

    if (pointers.current.size === 0) {
      if (everPinched.current || zoom.current.scale > 1) {
        resetZoom() // release pinch -> spring back (peek zoom)
      } else {
        const threshold = width() * 0.3 // less sensitive: needs a deliberate swipe
        let n = idxRef.current
        if (swipe.current.dx < -threshold && n < images.length - 1) n++
        else if (swipe.current.dx > threshold && n > 0) n--
        swipe.current.dx = 0
        if (n !== idxRef.current) {
          buzz(8)
          idxRef.current = n
          setIdx(n)
          onPhotoChange(n)
        }
        applyTrack(true)
      }
      everPinched.current = false
    } else if (pointers.current.size === 1 && zoom.current.scale > 1) {
      const p = pts()[0]
      pan.current = { x: p.x, y: p.y, tx: zoom.current.tx, ty: zoom.current.ty }
    }
  }

  function goTo(i: number) {
    widthRef.current = viewportRef.current?.clientWidth || 0
    idxRef.current = i
    setIdx(i)
    onPhotoChange(i)
    applyTrack(true)
  }

  return (
    <>
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div ref={trackRef} className="flex h-full">
          {images.map((src, i) => (
            <Slide
              key={i}
              src={src}
              number={i + 1}
              imgRef={(el) => {
                imgRefs.current[i] = el
              }}
            />
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center gap-1.5"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}
        >
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={() => goTo(i)}
              className={`pointer-events-auto h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </>
  )
}

/* ---------- main voter ---------- */

export default function Voter({ testId, series }: { testId: string; series: Series[] }) {
  const [index, setIndex] = useState(0)
  const [photo, setPhoto] = useState(0)
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
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white">
      {/* fullscreen gesture carousel */}
      <Carousel key={`series-${index}`} images={current.images} onPhotoChange={setPhoto} />

      {/* top overlay: progress + back, floating over the photo */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/45 to-transparent pb-10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex gap-1.5 px-3 pt-3">
          {series.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>
        {index > 0 && (
          <div className="px-3 pt-3">
            <button type="button" onClick={back} aria-label="Précédent" className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur active:scale-90">
              <ChevronLeftIcon />
            </button>
          </div>
        )}
      </div>

      {/* bottom overlay: choose button, floating over the photo */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-12"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {error && (
          <p className="mb-2 rounded-xl bg-red-500/20 px-3 py-2 text-center text-sm text-red-200">{error}</p>
        )}
        <button
          type="button"
          onClick={choose}
          className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
        >
          <CheckIcon /> Choisir la photo {photo + 1}
        </button>
      </div>
    </div>
  )
}
