import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lazy initialization: only create client when accessed, not at module load time
// This prevents build-time initialization issues
let _supabase = null
const clientOptions = {
  auth: {
    // Product requirement: app should open logged out by default.
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

function getSupabase() {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      if (typeof window !== 'undefined') {
        console.error('Missing Supabase environment variables. Please check your .env.local file.')
        throw new Error('Missing Supabase environment variables')
      }
      // During build, return a mock client to prevent errors
      _supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', clientOptions)
    } else {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)
    }
  }
  return _supabase
}

export const supabase = getSupabase()
