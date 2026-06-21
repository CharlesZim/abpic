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

/* ---------- one slide (blurred adaptive backdrop + contained photo) ---------- */

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
    <div className="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden">
      {/* adaptive backdrop: same photo, blurred & cover, so the letterbox area
          takes the photo's colors instead of black bands (Instagram-story feel) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-500 ${loaded ? 'opacity-60' : 'opacity-0'}`}
        style={{ pointerEvents: 'none' }}
      />
      <div className="absolute inset-0 bg-black/15" />

      {!loaded && <div className="absolute inset-8 animate-pulse rounded-2xl bg-white/10" />}

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
        className={`relative max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none', transformOrigin: 'center', willChange: 'transform' }}
      />
    </div>
  )
}

/* ---------- gesture carousel: swipe to navigate, pinch to zoom ---------- */

function Carousel({
  images,
  onPhotoChange,
  onZoomChange,
}: {
  images: string[]
  onPhotoChange: (i: number) => void
  onZoomChange: (active: boolean) => void
}) {
  const [idx, setIdx] = useState(0)
  const [zoomedUi, setZoomedUi] = useState(false)
  const idxRef = useRef(0) // kept in sync inside the gesture handlers below

  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const imgRefs = useRef<Array<HTMLImageElement | null>>([])
  const widthRef = useRef(0)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const everPinched = useRef(false)
  const zoomedRef = useRef(false)
  const swipe = useRef({ startX: 0, dx: 0, raw: 0 })
  const vel = useRef({ x: 0, t: 0, v: 0 })
  const pinch = useRef({ dist: 0, scale: 1, midX: 0, midY: 0, tx: 0, ty: 0 })
  const pan = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const zoom = useRef({ scale: 1, tx: 0, ty: 0 })

  const width = () => widthRef.current || viewportRef.current?.clientWidth || 1
  const pts = () => Array.from(pointers.current.values())
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  function setZoomActive(active: boolean) {
    if (zoomedRef.current === active) return
    zoomedRef.current = active
    setZoomedUi(active)
    onZoomChange(active)
  }

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
    setZoomActive(false)
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
        swipe.current = { startX: p.x, dx: 0, raw: 0 }
        vel.current = { x: p.x, t: e.timeStamp, v: 0 }
      }
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = pts()
      const m = mid(a, b)
      // Dampen the pinch so the zoom is less sensitive.
      const ratio = dist(a, b) / pinch.current.dist
      const damped = 1 + (ratio - 1) * 0.55
      zoom.current.scale = Math.min(4, Math.max(1, pinch.current.scale * damped))
      zoom.current.tx = pinch.current.tx + (m.x - pinch.current.midX)
      zoom.current.ty = pinch.current.ty + (m.y - pinch.current.midY)
      applyZoom()
      if (zoom.current.scale > 1.04) setZoomActive(true)
    } else if (pointers.current.size === 1) {
      const p = pts()[0]
      if (zoom.current.scale > 1) {
        zoom.current.tx = pan.current.tx + (p.x - pan.current.x)
        zoom.current.ty = pan.current.ty + (p.y - pan.current.y)
        applyZoom()
      } else if (!everPinched.current) {
        const raw = p.x - swipe.current.startX
        const atStart = idxRef.current === 0 && raw > 0
        const atEnd = idxRef.current === images.length - 1 && raw < 0
        swipe.current.raw = raw
        swipe.current.dx = atStart || atEnd ? raw * 0.3 : raw // rubber-band at edges
        const dt = e.timeStamp - vel.current.t
        if (dt > 0) vel.current.v = (p.x - vel.current.x) / dt
        vel.current.x = p.x
        vel.current.t = e.timeStamp
        applyTrack(false)
      }
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)

    if (pointers.current.size === 0) {
      if (everPinched.current || zoom.current.scale > 1) {
        resetZoom() // release pinch -> spring back, UI fades in
      } else {
        const threshold = width() * 0.2
        const flick = Math.abs(vel.current.v) > 0.35 // px/ms
        let n = idxRef.current
        const goNext = swipe.current.raw < -threshold || (flick && vel.current.v < 0)
        const goPrev = swipe.current.raw > threshold || (flick && vel.current.v > 0)
        if (goNext && n < images.length - 1) n++
        else if (goPrev && n > 0) n--
        swipe.current.dx = 0
        swipe.current.raw = 0
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
          className={`pointer-events-none absolute inset-x-0 bottom-3 flex justify-center transition-opacity duration-200 ${zoomedUi ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="flex gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => goTo(i)}
                className={`pointer-events-auto h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/55'}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- main voter ---------- */

export default function Voter({ testId, series }: { testId: string; series: Series[] }) {
  const [index, setIndex] = useState(0)
  const [photo, setPhoto] = useState(0)
  const [zoomed, setZoomed] = useState(false)
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white">
      {/* thin top bar: progress — only useful with more than one series */}
      {series.length > 1 && (
        <div
          className={`px-3 transition-opacity duration-200 ${zoomed ? 'opacity-0' : 'opacity-100'}`}
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: '8px' }}
        >
          <div className="flex gap-1.5">
            {series.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* photo area (bounded: stops above the button) */}
      <div className="relative min-h-0 flex-1">
        <Carousel key={`series-${index}`} images={current.images} onPhotoChange={setPhoto} onZoomChange={setZoomed} />

        {index > 0 && (
          <button
            type="button"
            onClick={back}
            aria-label="Précédent"
            className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-opacity duration-200 active:scale-90 ${zoomed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          >
            <ChevronLeftIcon />
          </button>
        )}
      </div>

      {/* bottom: choose button (photo never goes behind it) */}
      <div
        className={`px-4 pt-2 transition-opacity duration-200 ${zoomed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
      >
        {error && (
          <p className="mb-2 rounded-xl bg-red-500/20 px-3 py-2 text-center text-sm text-red-200">{error}</p>
        )}
        <button
          type="button"
          onClick={choose}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
        >
          <CheckIcon /> Choisir la photo {photo + 1}
        </button>
      </div>
    </div>
  )
}
