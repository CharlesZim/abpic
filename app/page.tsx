'use client'

import imageCompression from 'browser-image-compression'
import { useState } from 'react'

import { Wordmark } from '@/app/_components/wordmark'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

type Photo = {
  id: string
  file: File
  preview: string
  url: string | null
  uploading: boolean
  failed: boolean
}
type Series = { id: string; photos: Photo[] }

const DURATIONS = ['1h', '3h', '6h', '12h', '24h'] as const
type Duration = (typeof DURATIONS)[number]

const MAX_SERIES = 5
const MIN_SERIES = 1
const MAX_PHOTOS = 5
const MIN_PHOTOS = 2

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1080,
  maxSizeMB: 0.4,
  // Force JPEG output: this also decodes HEIC natively (iOS Safari) so we
  // don't need a heavy WASM converter that can hang.
  fileType: 'image/jpeg',
  useWebWorker: false,
}

function newId() {
  return crypto.randomUUID()
}

function emptySeries(): Series {
  return { id: newId(), photos: [] }
}

/* ---------- icons ---------- */

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Spinner() {
  return (
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
  )
}

export default function Home() {
  const [name, setName] = useState('')
  const [series, setSeries] = useState<Series[]>([emptySeries()])
  const [duration, setDuration] = useState<Duration>('3h')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)
  const [resultsToken, setResultsToken] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function updatePhoto(seriesId: string, photoId: string, fn: (p: Photo) => Photo) {
    setSeries((prev) =>
      prev.map((s) =>
        s.id !== seriesId ? s : { ...s, photos: s.photos.map((p) => (p.id === photoId ? fn(p) : p)) }
      )
    )
  }

  async function uploadOne(seriesId: string, photo: Photo) {
    let blob: Blob = photo.file
    try {
      blob = await imageCompression(photo.file, COMPRESSION_OPTIONS)
    } catch {
      blob = photo.file
    }
    // Swap the preview to the compressed JPEG so it renders in every browser.
    const newPreview = URL.createObjectURL(blob)
    updatePhoto(seriesId, photo.id, (p) => {
      if (p.preview) URL.revokeObjectURL(p.preview)
      return { ...p, preview: newPreview }
    })

    try {
      const r = await fetch('/api/sign-upload', { method: 'POST' })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) throw new Error()
      const sb = getSupabaseBrowser()
      const { error: upErr } = await sb.storage
        .from('photos')
        .uploadToSignedUrl(d.path, d.token, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      updatePhoto(seriesId, photo.id, (p) => ({ ...p, url: d.publicUrl, uploading: false, failed: false }))
    } catch {
      updatePhoto(seriesId, photo.id, (p) => ({ ...p, uploading: false, failed: true }))
    }
  }

  function addPhotos(seriesId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const current = series.find((s) => s.id === seriesId)
    const room = current ? MAX_PHOTOS - current.photos.length : 0
    if (room <= 0) return

    const adding: Photo[] = Array.from(fileList)
      .slice(0, room)
      .map((file) => ({
        id: newId(),
        file,
        preview: URL.createObjectURL(file),
        url: null,
        uploading: true,
        failed: false,
      }))

    setSeries((prev) =>
      prev.map((s) => (s.id === seriesId ? { ...s, photos: [...s.photos, ...adding] } : s))
    )
    adding.forEach((p) => uploadOne(seriesId, p))
  }

  function retry(seriesId: string, photo: Photo) {
    updatePhoto(seriesId, photo.id, (p) => ({ ...p, uploading: true, failed: false }))
    uploadOne(seriesId, photo)
  }

  function addSeries() {
    setSeries((prev) => (prev.length >= MAX_SERIES ? prev : [...prev, emptySeries()]))
  }

  function removeSeries(seriesId: string) {
    setSeries((prev) => {
      if (prev.length <= MIN_SERIES) return prev
      const target = prev.find((s) => s.id === seriesId)
      target?.photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
      return prev.filter((s) => s.id !== seriesId)
    })
  }

  function removePhoto(seriesId: string, photoId: string) {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s
        const target = s.photos.find((p) => p.id === photoId)
        if (target?.preview) URL.revokeObjectURL(target.preview)
        return { ...s, photos: s.photos.filter((p) => p.id !== photoId) }
      })
    )
  }

  const countsOk =
    series.length >= MIN_SERIES &&
    series.length <= MAX_SERIES &&
    series.every((s) => s.photos.length >= MIN_PHOTOS && s.photos.length <= MAX_PHOTOS)
  const anyUploading = series.some((s) => s.photos.some((p) => p.uploading))
  const anyFailed = series.some((s) => s.photos.some((p) => p.failed))
  const canSubmit = countsOk && !anyUploading && !anyFailed

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          name: name.trim() || undefined,
          series: series.map((s) => s.photos.map((p) => p.url)),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || `Échec serveur (${res.status})`)
      }
      setResultId(data.id)
      setResultsToken(data.resultsToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le test. Réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------- success screen ---------- */

  if (resultId) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const shareLink = `${origin}/v/${resultId}`
    const resultsLink = `${origin}/r/${resultsToken}`

    async function copy(key: string, value: string) {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }

    async function share() {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: 'Aide-moi à choisir 📸',
            text: 'Quelle photo je poste ? Vote pour ta préférée 👇',
            url: shareLink,
          })
        } catch {
          // user dismissed the share sheet
        }
      } else {
        copy('share', shareLink)
      }
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6 sm:max-w-lg">
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">
            <CheckIcon size={32} />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Ton test est prêt !</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Envoie le lien à tes amis pour qu’ils votent.
          </p>
        </div>

        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98]"
        >
          <ShareIcon /> Partager le lien
        </button>
        <button
          type="button"
          onClick={() => copy('share', shareLink)}
          className="-mt-3 text-center text-sm font-medium text-zinc-500"
        >
          {copiedKey === 'share' ? 'Lien copié ✓' : 'ou copier le lien'}
        </button>

        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold">Tes résultats</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Garde ce lien pour suivre les votes (à toi seul).
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={resultsLink}
              className="flex-1 rounded-xl bg-zinc-900 py-3 text-center text-sm font-semibold text-white dark:bg-white dark:text-black"
            >
              Voir les résultats
            </a>
            <button
              type="button"
              onClick={() => copy('results', resultsLink)}
              className="rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
            >
              {copiedKey === 'results' ? 'Copié ✓' : 'Copier'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setResultId(null)
            setResultsToken(null)
            setSeries([emptySeries()])
          }}
          className="text-center text-sm text-zinc-500 underline"
        >
          Créer un autre test
        </button>
      </main>
    )
  }

  /* ---------- builder ---------- */

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col sm:max-w-lg">
      <div className="flex-1 space-y-6 p-5">
        <header className="space-y-2 pt-2">
          <Wordmark className="text-lg" />
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
            Quelle photo je poste ?
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ajoute tes photos, tes amis votent pour la meilleure.
          </p>
        </header>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Ton prénom (optionnel)"
          className="w-full rounded-2xl border border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-fuchsia-500 dark:border-zinc-800"
        />

        <div className="space-y-4">
          {series.map((s, i) => (
            <section
              key={s.id}
              className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">
                  {series.length > 1 ? `Série ${i + 1}` : 'Tes photos'}
                </h2>
                {series.length > MIN_SERIES && (
                  <button
                    type="button"
                    onClick={() => removeSeries(s.id)}
                    className="text-xs font-medium text-zinc-400 hover:text-red-500"
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {s.photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt=""
                      className="h-full w-full rounded-xl object-cover"
                      style={{ imageOrientation: 'from-image' }}
                    />
                    {photo.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                        <Spinner />
                      </div>
                    )}
                    {photo.failed && (
                      <button
                        type="button"
                        onClick={() => retry(s.id, photo)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-black/60 text-[11px] font-medium text-white"
                      >
                        <span className="text-base">⚠️</span>
                        Réessayer
                      </button>
                    )}
                    {!photo.uploading && (
                      <button
                        type="button"
                        onClick={() => removePhoto(s.id, photo.id)}
                        aria-label="Retirer la photo"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur active:scale-90"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {s.photos.length < MAX_PHOTOS && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 transition active:scale-95 dark:border-zinc-700">
                    <PlusIcon />
                    <span className="text-[11px] font-medium">Ajouter</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addPhotos(s.id, e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>

              <p className="mt-2.5 text-xs text-zinc-400">
                {s.photos.length}/{MAX_PHOTOS} photos · min. {MIN_PHOTOS}
              </p>
            </section>
          ))}
        </div>

        {series.length < MAX_SERIES && (
          <button
            type="button"
            onClick={addSeries}
            className="w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 active:scale-[0.99] dark:border-zinc-700"
          >
            + Ajouter une autre série
          </button>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">Durée du vote</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  duration === d
                    ? 'border-transparent bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-zinc-200 bg-white/85 px-5 pt-3 backdrop-blur dark:border-zinc-800 dark:bg-black/80"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
      >
        {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
        {!error && !canSubmit && (
          <p className="mb-2 text-center text-xs text-zinc-400">
            {anyUploading
              ? 'Envoi des photos…'
              : anyFailed
                ? 'Une photo n’a pas pu être envoyée — tape dessus pour réessayer.'
                : `Ajoute au moins ${MIN_PHOTOS} photos par série.`}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {submitting ? 'Création…' : 'Créer le test'}
        </button>
      </div>
    </main>
  )
}
