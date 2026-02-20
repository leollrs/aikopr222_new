import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const withTimeout = (promise, ms, label = 'operation') =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ])

  const resolveFallbackRole = (authUser) => {
    return authUser?.app_metadata?.role || authUser?.user_metadata?.role || null
  }

  const normalizeRole = (role) => {
    if (role === 'admin' || role === 'client') return role
    return null
  }

  const readRoleViaRpc = async () => {
    const { data, error } = await withTimeout(supabase.rpc('get_my_role'), 6000, 'get_my_role')
    if (error) throw error
    return normalizeRole(data)
  }

  const readRoleViaUsersTable = async (authUser) => {
    const { data, error } = await withTimeout(
      supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle(),
      6000,
      'users-role-query'
    )

    if (error) throw error
    return normalizeRole(data?.role)
  }

  const fetchUserRole = async (authUser) => {
    if (!authUser?.id) {
      setUserRole(null)
      return null
    }

    try {
      const rpcRole = await readRoleViaRpc()
      if (rpcRole) {
        setUserRole(rpcRole)
        return rpcRole
      }
    } catch (rpcError) {
      // If RPC does not exist in DB yet, fallback to direct table query.
      const code = rpcError?.code || rpcError?.status || 'unknown'
      if (!['42883', 'PGRST202'].includes(code)) {
        console.warn('get_my_role RPC failed, falling back to users table:', rpcError)
      }
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const tableRole = await readRoleViaUsersTable(authUser)
        if (tableRole) {
          setUserRole(tableRole)
          return tableRole
        }
      } catch (tableError) {
        if (attempt === 1) {
          console.error('Error fetching role from users table:', tableError)
        }
      }

      await wait(200 * (attempt + 1))
    }

    const fallbackRole = normalizeRole(resolveFallbackRole(authUser))
    if (!fallbackRole) {
      console.warn(
        `No role found for authenticated user id=${authUser.id} email=${authUser.email || 'unknown'}.`
      )
    }
    setUserRole(fallbackRole)
    return fallbackRole
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), 4000, 'getSession')

        if (!mounted) return

        if (!session?.user) {
          setUser(null)
          setUserRole(null)
          setLoading(false)
          return
        }

        // Validate local session with server to avoid stale "logged-in" UI state.
        const { data: userResult, error: getUserError } = await withTimeout(
          supabase.auth.getUser(),
          5000,
          'getUser'
        )

        if (!mounted) return

        const verifiedUser = userResult?.user
        if (getUserError || !verifiedUser) {
          console.warn('Invalid/stale session detected, clearing local session.')
          await supabase.auth.signOut({ scope: 'local' })
          setUser(null)
          setUserRole(null)
          setLoading(false)
          return
        }

        setUser(verifiedUser)
        setUserRole(resolveFallbackRole(verifiedUser))
        setLoading(false)
        void fetchUserRole(verifiedUser)
      } catch (error) {
        if (!mounted) return
        console.error('Auth initialization failed:', error)
        setUser(null)
        setUserRole(null)
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (!session?.user) {
        setUser(null)
        setUserRole(null)
        setLoading(false)
        return
      }

      setUser(session.user)
      setUserRole(resolveFallbackRole(session.user))
      setLoading(false)
      void fetchUserRole(session.user)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error

    if (data?.session?.access_token && data?.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }

    const { data: userResult } = await withTimeout(supabase.auth.getUser(), 5000, 'getUser')
    const authenticatedUser = userResult?.user || data?.user
    setUser(authenticatedUser ?? null)
    setLoading(false)
    const resolvedRole = await fetchUserRole(authenticatedUser)
    return { ...data, userRole: resolvedRole, userId: authenticatedUser?.id || null }
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error

    // users row is created by DB trigger handle_new_user on auth.users insert.
    // Avoid client-side insert here to prevent RLS/duplicate-row failures.

    return data
  }

  const signOut = async () => {
    // Clear local state first so UI always logs out immediately.
    setUser(null)
    setUserRole(null)
    setLoading(false)

    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      console.warn('Local sign out warning:', error)
    }
  }

  const value = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
