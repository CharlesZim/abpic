import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Public (anon) client for the browser. Only used to upload photos straight
// to Supabase Storage via short-lived signed upload URLs, so the files never
// pass through the Vercel function (which caps request bodies at ~4.5 MB).
let cached: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Configuration manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    )
  }

  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
