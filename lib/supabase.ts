import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role secret key.
// NEVER import this module from a client component — the `server-only`
// import above will throw at build time if that happens.

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable'
    )
  }

  cached = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}
