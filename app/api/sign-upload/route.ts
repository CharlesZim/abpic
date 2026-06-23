import { nanoid } from 'nanoid'

import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const PHOTOS_BUCKET = 'photos'

// Returns a signed upload URL for a fresh, server-controlled path so the
// browser can upload a single photo straight to Storage as soon as it's
// picked (before the test is created).
export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    const path = `uploads/${nanoid()}/${nanoid()}.jpg`

    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUploadUrl(path)

    if (error || !data) {
      console.error('[api/sign-upload] failed:', error)
      return Response.json({ error: 'Préparation de l’envoi impossible.' }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl
    return Response.json({ path, token: data.token, publicUrl })
  } catch (err) {
    console.error('[api/sign-upload] failed:', err)
    return Response.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
