import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user, userRole, loading, roleLoading } = useAuth()

  if (loading || (role && user && roleLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-ink-light">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && userRole !== role) {
    return <Navigate to="/" replace />
  }

  return children
}
