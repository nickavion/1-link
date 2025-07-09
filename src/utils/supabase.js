import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database table names
export const TABLES = {
  EVENTS: 'events',
  USERS: 'users',
  ATTENDEES: 'attendees'
}

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

// Events helpers
export const events = {
  getAll: async () => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .select('*')
      .order('created_at', { ascending: false })
    return { data, error }
  },
  
  getById: async (id) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },
  
  create: async (eventData) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .insert([eventData])
      .select()
      .single()
    return { data, error }
  },
  
  update: async (id, eventData) => {
    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .update(eventData)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },
  
  delete: async (id) => {
    const { error } = await supabase
      .from(TABLES.EVENTS)
      .delete()
      .eq('id', id)
    return { error }
  }
}