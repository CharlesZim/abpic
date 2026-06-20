'use client'

import imageCompression from 'browser-image-compression'
import { useState } from 'react'

type Photo = { id: string; file: File; preview: string }
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
  // Run on the main thread: the web-worker path imports the library from a
  // CDN at runtime, which fails (e.g. Safari throws "The string did not match
  // the expected pattern.") when that request is blocked or offline.
  useWebWorker: false,
}

function newId() {
  return crypto.randomUUID()
}

function emptySeries(): Series {
  return { id: newId(), photos: [] }
}

export default function Home() {
  const [series, setSeries] = useState<Series[]>([emptySeries()])
  const [duration, setDuration] = useState<Duration>('3h')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)
  const [resultsToken, setResultsToken] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function addSeries() {
    setSeries((prev) =>
      prev.length >= MAX_SERIES ? prev : [...prev, emptySeries()]
    )
  }

  function removeSeries(seriesId: string) {
    setSeries((prev) => {
      if (prev.length <= MIN_SERIES) return prev
      const target = prev.find((s) => s.id === seriesId)
      target?.photos.forEach((p) => URL.revokeObjectURL(p.preview))
      return prev.filter((s) => s.id !== seriesId)
    })
  }

  function addPhotos(seriesId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const incoming = Array.from(fileList)
    setSeries((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s
        const room = MAX_PHOTOS - s.photos.length
        const added = incoming.slice(0, room).map((file) => ({
          id: newId(),
          file,
          preview: URL.createObjectURL(file),
        }))
        return { ...s, photos: [...s.photos, ...added] }
      })
    )
  }

  function removePhoto(seriesId: string, photoId: string) {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s
        const target = s.photos.find((p) => p.id === photoId)
        if (target) URL.revokeObjectURL(target.preview)
        return { ...s, photos: s.photos.filter((p) => p.id !== photoId) }
      })
    )
  }

  function validate(): string | null {
    if (series.length < MIN_SERIES || series.length > MAX_SERIES) {
      return `Add ${MIN_SERIES} to ${MAX_SERIES} series.`
    }
    for (let i = 0; i < series.length; i++) {
      const count = series[i].photos.length
      if (count < MIN_PHOTOS || count > MAX_PHOTOS) {
        return `Series ${i + 1} needs ${MIN_PHOTOS} to ${MAX_PHOTOS} photos.`
      }
    }
    return null
  }

  async function handleSubmit() {
    setError(null)
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('duration', duration)
      formData.append('seriesOrder', JSON.stringify(series.map((s) => s.id)))

      for (const s of series) {
        for (const photo of s.photos) {
          let toUpload: Blob = photo.file
          try {
            toUpload = await imageCompression(photo.file, COMPRESSION_OPTIONS)
          } catch {
            // If compression fails for an image, upload the original instead.
            toUpload = photo.file
          }
          formData.append(`series_${s.id}`, toUpload, photo.file.name)
        }
      }

      const res = await fetch('/api/create', { method: 'POST', body: formData })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
      setResultId(data.id)
      setResultsToken(data.resultsToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (resultId) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const shareLink = `${origin}/v/${resultId}`
    const resultsLink = `${origin}/r/${resultsToken}`

    async function copy(key: string, value: string) {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">Test created</h1>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Share this link to collect votes</p>
          <code className="break-all rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {shareLink}
          </code>
          <button
            type="button"
            onClick={() => copy('share', shareLink)}
            className="rounded-lg bg-black px-4 py-3 font-medium text-white dark:bg-white dark:text-black"
          >
            {copiedKey === 'share' ? 'Copied!' : 'Copy voting link'}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Your results link — keep this to check results later
          </p>
          <code className="break-all rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {resultsLink}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copy('results', resultsLink)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-600"
            >
              {copiedKey === 'results' ? 'Copied!' : 'Copy results link'}
            </button>
            <a
              href={resultsLink}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-center font-medium dark:border-zinc-600"
            >
              View results
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setResultId(null)
            setResultsToken(null)
            setSeries([emptySeries()])
          }}
          className="text-sm text-zinc-500 underline"
        >
          Create another test
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">AB Photo MVP</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Add 1–5 series of 2–5 photos, pick how long the test runs, then create it.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {series.map((s, i) => (
          <section
            key={s.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Series {i + 1}</h2>
              {series.length > MIN_SERIES && (
                <button
                  type="button"
                  onClick={() => removeSeries(s.id)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              )}
            </div>

            {s.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {s.photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt=""
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(s.id, photo.id)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-zinc-500">
              {s.photos.length} / {MAX_PHOTOS} photos
            </p>

            {s.photos.length < MAX_PHOTOS && (
              <label className="cursor-pointer rounded-lg border border-dashed border-zinc-300 p-3 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                Add photos
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
          </section>
        ))}
      </div>

      {series.length < MAX_SERIES && (
        <button
          type="button"
          onClick={addSeries}
          className="rounded-lg border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-600"
        >
          + Add series
        </button>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Duration</span>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                duration === d
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zinc-300 dark:border-zinc-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? 'Creating…' : 'Create test'}
      </button>
    </main>
  )
}
