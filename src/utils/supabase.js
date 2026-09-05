import { createClient } from '@supabase/supabase-js'
import { TAG_COLUMNS, sanitizeTags } from './tags'
import { isConfigured, supabaseUrl, supabaseAnonKey } from './config'

// The anon key is a public credential: it ships in the bundle, and Row Level
// Security is what decides which rows it can reach. The service_role key bypasses
// RLS entirely and must never appear in this file or anywhere else under src/.
//
// With no keys configured, main.jsx renders the setup screen instead of the app, so
// nothing below is ever called. The stand-in exists only so importing this module
// cannot crash the page before that screen gets a chance to render.
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy(
      {},
      {
        get() {
          throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.')
        }
      }
    )

// Database table names
export const TABLES = {
  EVENTS: 'events',
  USERS: 'users',
  ATTENDEES: 'attendees',
  USER_PREFERENCES: 'user_preferences'
}

export const EVENT_IMAGES_BUCKET =
  import.meta.env.VITE_SUPABASE_EVENT_IMAGES_BUCKET || 'event-images'

// Auth helpers
export const auth = {
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  },
  
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  },
  
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },
  
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
}

/** Tags are re-checked on the way out as well as on the way in — never trust a row. */
const normalizeEvent = (row) =>
  row && {
    ...row,
    identity_tags: sanitizeTags('identity_tags', row.identity_tags),
    event_type_tags: sanitizeTags('event_type_tags', row.event_type_tags),
    vibe_tags: sanitizeTags('vibe_tags', row.vibe_tags),
    going_count: row.going_count || 0
  }

// Events helpers
export const events = {
  /**
   * Filters are OR within a tag group and AND across groups: picking "gay" and
   * "lesbian" widens the results, picking "gay" and "workshop" narrows them.
   * `overlaps` is the array operator that means "any of" — `contains` would demand
   * all of them. This is what the GIN indexes in 0002 are for.
   */
  getAll: async ({ filters = {}, search = '', includePast = false } = {}) => {
    let query = supabase
      .from(TABLES.EVENTS)
      .select('*')
      .order('start_date', { ascending: true })

    if (!includePast) {
      query = query.gte('start_date', new Date().toISOString())
    }

    for (const column of TAG_COLUMNS) {
      const selected = sanitizeTags(column, filters[column])
      if (selected.length) query = query.overlaps(column, selected)
    }

    const term = search.trim()
    if (term) {
      // Commas and parens are PostgREST filter syntax inside .or()
      const escaped = term.replace(/[,%()]/g, ' ')
      query = query.or(`title.ilike.%${escaped}%,location.ilike.%${escaped}%`)
    }

    const { data, error } = await query
    return { data: (data || []).map(normalizeEvent), error }
  },

  getMine: async (userId) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
    return { data: (data || []).map(normalizeEvent), error }
  },
  
  getById: async (id) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    return { data: normalizeEvent(data), error }
  },
  
  create: async (eventData) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .insert([eventData])
      .select()
      .single()
    return { data: normalizeEvent(data), error }
  },
  
  update: async (id, eventData) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .update(eventData)
      .eq('id', id)
      .select()
      .single()
    return { data: normalizeEvent(data), error }
  },
  
  delete: async (id) => {
    const { error } = await supabase
      .from(TABLES.EVENTS)
      .delete()
      .eq('id', id)
    return { error }
  }
}
// Attendee helpers
export const attendees = {
  getMine: async (eventId, userId) => {
    if (!userId) return { data: null, error: null }
    const { data, error } = await supabase
      .from(TABLES.ATTENDEES)
      .select('id, event_id, user_id, status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()
    return { data, error }
  },

  rsvp: async (eventId, userId, status = 'approved') => {
    const { data, error } = await supabase
      .from(TABLES.ATTENDEES)
      .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' })
      .select('id, event_id, user_id, status')
      .single()
    return { data, error }
  }
}

// Private per-user preferences (section 3). RLS makes these unreadable by any
// other account, including organisers of events the user has RSVPed to.
export const preferences = {
  get: async (userId) => {
    if (!userId) return { data: null, error: null }
    const { data, error } = await supabase
      .from(TABLES.USER_PREFERENCES)
      .select('user_id, identity_tags, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return { data: null, error }
    return {
      data: { ...data, identity_tags: sanitizeTags('identity_tags', data.identity_tags) },
      error
    }
  },

  save: async (userId, identityTags) => {
    const { data, error } = await supabase
      .from(TABLES.USER_PREFERENCES)
      .upsert(
        {
          user_id: userId,
          identity_tags: sanitizeTags('identity_tags', identityTags),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, identity_tags, updated_at')
      .single()
    return { data, error }
  }
}

// Cover image upload (section 6, step 6). The bucket policy in 0004_storage.sql
// only accepts objects under a folder named for the uploader, so the path here is
// not a convention the client is free to ignore.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const storage = {
  uploadCoverImage: async (file, userId) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { data: null, error: { message: 'Cover images must be JPEG, PNG, WebP or AVIF.' } }
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { data: null, error: { message: 'Cover images must be under 5 MB.' } }
    }

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${userId}/${crypto.randomUUID()}.${extension}`

    const { error } = await supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) return { data: null, error }

    const { data } = supabase.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(path)
    return { data: data.publicUrl, error: null }
  }
}
