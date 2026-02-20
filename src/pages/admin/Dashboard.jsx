import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [servicesRes, promotionsRes, appointmentsRes] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase
          .from('appointments')
          .select('id, appointment_date, status')
          .gte('appointment_date', new Date().toISOString())
          .order('appointment_date', { ascending: true })
          .limit(10),
      ])

      return {
        totalServices: servicesRes.count || 0,
        activePromotions: promotionsRes.count || 0,
        upcomingAppointments: appointmentsRes.data || [],
      }
    },
  })

  const featuredServiceQuery = useQuery({
    queryKey: ['featured-service'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('featured', true)
        .eq('active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="container py-12">
          <p className="text-ink-light">Cargando estadísticas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-serif text-ink-dark mb-2">Panel de Administración</h1>
            <p className="text-ink-light">Bienvenido al panel de control</p>
          </div>
          <Link
            to="/"
            className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
          >
            Inicio
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Servicios Activos</p>
                <p className="text-3xl font-serif text-ink-dark">{stats?.totalServices || 0}</p>
              </div>
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Promociones Activas</p>
                <p className="text-3xl font-serif text-ink-dark">{stats?.activePromotions || 0}</p>
              </div>
              <div className="w-12 h-12 bg-cocoa/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cocoa">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-light text-sm mb-1">Próximas Citas</p>
                <p className="text-3xl font-serif text-ink-dark">
                  {stats?.upcomingAppointments?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="font-serif text-xl text-ink-dark mb-4">Acciones Rápidas</h2>
            <div className="space-y-3">
              <Link
                to="/admin/services"
                className="block w-full px-6 py-3 btnPrimary rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all text-center"
              >
                Gestionar Servicios
              </Link>
              <Link
                to="/admin/promotions"
                className="block w-full px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
              >
                Gestionar Promociones
              </Link>
            </div>
          </div>

          {/* Featured Service */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="font-serif text-xl text-ink-dark mb-4">Servicio de la Semana</h2>
            {featuredServiceQuery.isLoading ? (
              <p className="text-ink-light">Cargando...</p>
            ) : featuredServiceQuery.data ? (
              <div>
                <h3 className="font-serif text-lg text-ink-dark mb-2">
                  {featuredServiceQuery.data.name}
                </h3>
                <p className="text-ink-light text-sm mb-4">{featuredServiceQuery.data.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gold font-semibold">${featuredServiceQuery.data.price}</span>
                  <Link
                    to="/admin/services"
                    className="text-sm text-gold hover:underline"
                  >
                    Cambiar →
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-ink-light text-sm mb-4">
                  No hay servicio destacado. Selecciona uno desde la gestión de servicios.
                </p>
                <Link
                  to="/admin/services"
                  className="text-sm text-gold hover:underline"
                >
                  Ir a Servicios →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        {stats?.upcomingAppointments && stats.upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="font-serif text-xl text-ink-dark mb-4">Próximas Citas</h2>
            <div className="space-y-3">
              {stats.upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md"
                >
                  <div>
                    <p className="font-semibold text-ink-dark">
                      {new Date(appointment.appointment_date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-ink-light capitalize">{appointment.status}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                      appointment.status === 'confirmed'
                        ? 'bg-success/20 text-success'
                        : appointment.status === 'pending'
                        ? 'bg-gold/20 text-gold'
                        : 'bg-ink-light/20 text-ink-light'
                    }`}
                  >
                    {appointment.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
