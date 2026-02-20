import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ClientDashboard() {
  const { user } = useAuth()

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['client-appointments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, services(name, price, image_url)')
        .eq('client_id', user?.id)
        .order('appointment_date', { ascending: false })
        .limit(5)

      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  const upcomingAppointments = appointments?.filter(
    (apt) => new Date(apt.appointment_date) >= new Date() && apt.status !== 'cancelled'
  ) || []

  const pastAppointments = appointments?.filter(
    (apt) => new Date(apt.appointment_date) < new Date() || apt.status === 'completed'
  ) || []

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif text-ink-dark mb-2">Mi Cuenta</h1>
          <p className="text-ink-light">Bienvenido a tu panel de cliente</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Próximas Citas</p>
                <p className="text-3xl font-serif text-ink-dark">{upcomingAppointments.length}</p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Citas Pasadas</p>
                <p className="text-3xl font-serif text-ink-dark">{pastAppointments.length}</p>
              </div>
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Servicios</p>
                <p className="text-3xl font-serif text-ink-dark">{appointments?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-cocoa/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cocoa">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-ink-dark">Próximas Citas</h2>
              <Link
                to="/client/appointments"
                className="text-sm text-gold hover:underline"
              >
                Ver todas →
              </Link>
            </div>
            {isLoading ? (
              <p className="text-ink-light">Cargando...</p>
            ) : upcomingAppointments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-light mb-4">No tienes citas próximas</p>
                <a
                  href="/"
                  className="inline-block btnPrimary px-6 py-2 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all"
                >
                  Agendar Cita
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border border-border rounded-md hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-ink-dark mb-1">
                          {appointment.services?.name || 'Servicio'}
                        </h3>
                        <p className="text-sm text-ink-light">
                          {new Date(appointment.appointment_date).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-ink-light mt-1 capitalize">
                          {appointment.location === 'domicilio' ? 'A domicilio' : 'En local'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                          appointment.status === 'confirmed'
                            ? 'bg-success/20 text-success'
                            : 'bg-gold/20 text-gold'
                        }`}
                      >
                        {appointment.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-ink-dark">Acciones Rápidas</h2>
            </div>
            <div className="space-y-3">
              <Link
                to="/client/appointments"
                className="block w-full px-6 py-3 btnPrimary rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all text-center"
              >
                Ver Mis Citas
              </Link>
              <Link
                to="/client/profile"
                className="block w-full px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
              >
                Editar Perfil
              </Link>
              <a
                href="/"
                className="block w-full px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
              >
                Agendar Nueva Cita
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
