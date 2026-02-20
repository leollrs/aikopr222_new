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
      // Do not hard-crash the app in production if env is missing.
      // Use a placeholder client so UI still renders and surfaces errors gracefully.
      if (typeof window !== 'undefined') {
        console.error(
          'Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'
        )
      }
      _supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', clientOptions)
    } else {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)
    }
  }
  return _supabase
}

export const supabase = getSupabase()
