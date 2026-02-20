import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'signup') {
      setIsSignUp(true)
      setShowResetPassword(false)
      return
    }

    if (mode === 'signin') {
      setIsSignUp(false)
      setShowResetPassword(false)
    }
  }, [searchParams])

  const getAuthErrorMessage = (error) => {
    const raw = (error?.message || '').toLowerCase()

    if (raw.includes('email rate limit exceeded') || raw.includes('over_email_send_rate_limit')) {
      return 'Límite de correos alcanzado. Espera unos minutos o crea el usuario desde Supabase (Auth > Users).'
    }

    if (raw.includes('user already registered')) {
      return 'Este email ya está registrado. Intenta iniciar sesión o restablecer contraseña.'
    }

    if (raw.includes('email not confirmed')) {
      return 'Tu email aún no está confirmado. Revisa tu correo o confirma el usuario en Supabase Auth > Users.'
    }

    return error?.message || 'Error al autenticar'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        toast.success('Cuenta creada. Por favor inicia sesión.')
        setIsSignUp(false)
      } else {
        const { userRole, userId } = await signIn(email, password)
        toast.success('Sesión iniciada')

        // Redirect based on freshly resolved role
        if (userRole === 'admin') {
          navigate('/admin/dashboard')
        } else if (userRole === 'client') {
          navigate('/client/dashboard')
        } else {
          toast.error(
            `Tu cuenta no tiene un rol asignado (admin/client). User ID: ${userId || 'unknown'}`
          )
          navigate('/')
        }
      }
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('Por favor ingresa tu email')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success('Revisa tu email para el enlace de restablecimiento')
      setShowResetPassword(false)
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-ink-dark mb-6 text-center">
          {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h1>
        {showResetPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-ink-light text-sm mb-4">
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-ink mb-1">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btnPrimary py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar Enlace'}
            </button>
            <button
              type="button"
              onClick={() => setShowResetPassword(false)}
              className="w-full text-gold hover:underline text-sm"
            >
              Volver a iniciar sesión
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
              {!isSignUp && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(true)}
                    className="text-sm text-gold hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full btnPrimary py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Cargando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-gold hover:underline"
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
              </button>
            </div>
          </>
        )}
        <div className="mt-4 text-center">
          <a href="/" className="text-ink-light hover:underline text-sm">
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
