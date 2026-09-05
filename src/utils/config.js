const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * False when nobody has filled in .env yet. The app renders a setup screen instead
 * of a blank page, which is the difference between "I mistyped something" and
 * "this project is broken".
 */
export const isConfigured = Boolean(url && anonKey && !url.includes('your-project-ref'))

export const supabaseUrl = url
export const supabaseAnonKey = anonKey

/** True while running against scripts/mock-supabase.mjs (`npm run dev:mock`). */
export const usingMockBackend =
  isConfigured && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)
