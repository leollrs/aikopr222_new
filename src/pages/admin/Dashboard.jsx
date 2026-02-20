import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

const statusLabels = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const parseAppointmentNotes = (rawNotes = '') => {
  const notes = String(rawNotes || '')

  const parsed = {
    fullName: '',
    email: '',
    phone: '',
    contactMethod: '',
    address: '',
    mainGoal: '',
    additionalNotes: '',
    promotion: '',
    calendarEventId: '',
    calendarSource: '',
  }

  // The first note block can arrive as:
  // "Cliente: X, Email: Y, Tel: Z"
  // so we parse each token independently instead of relying on "|" only.
  const readValue = (labelRegex) => {
    const match = notes.match(labelRegex)
    return match?.[1]?.trim() || ''
  }

  parsed.fullName = readValue(/cliente:\s*([^|,]+?)(?:,| \| |$)/i)
  parsed.email = readValue(/email:\s*([^|,]+?)(?:,| \| |$)/i)
  parsed.phone = readValue(/tel:\s*([^|,]+?)(?:,| \| |$)/i)
  parsed.contactMethod = readValue(/método de contacto:\s*([^|]+?)(?: \| |$)/i)
  parsed.address = readValue(/dirección:\s*([^|]+?)(?: \| |$)/i)
  parsed.mainGoal = readValue(/objetivo:\s*([^|]+?)(?: \| |$)/i)
  parsed.additionalNotes = readValue(/notas:\s*([^|]+?)(?: \| |$)/i)
  parsed.promotion = readValue(/promoción:\s*([^|]+?)(?: \| |$)/i)
  parsed.calendarEventId = readValue(/calendar event id:\s*([^|]+?)(?: \| |$)/i)
  parsed.calendarSource = readValue(/calendar source:\s*([^|]+?)(?: \| |$)/i)

  return parsed
}

const toDateInputValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toTimeInputValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [isEditingAppointment, setIsEditingAppointment] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    time: '',
    location: 'local',
    status: 'pending',
  })
  const [calendarActionLoading, setCalendarActionLoading] = useState(false)
  const [calendarNotice, setCalendarNotice] = useState('')

  const openAppointmentDetail = (appointment) => {
    setSelectedAppointment(appointment)
    setIsEditingAppointment(false)
    setAppointmentForm({
      date: toDateInputValue(appointment?.appointment_date),
      time: toTimeInputValue(appointment?.appointment_date),
      location: appointment?.location || 'local',
      status: appointment?.status || 'pending',
    })
  }

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase
        .from('appointments')
        .update(patch)
        .eq('id', id)
      if (error) throw error
      return { id, patch }
    },
    onSuccess: ({ id, patch }) => {
      toast.success('Cita actualizada')
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setSelectedAppointment((prev) => {
        if (!prev || prev.id !== id) return prev
        return { ...prev, ...patch }
      })
    },
    onError: (error) => {
      toast.error('No se pudo actualizar la cita')
      console.error(error)
    },
  })

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      toast.success('Cita eliminada')
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setSelectedAppointment(null)
      setIsEditingAppointment(false)
    },
    onError: (error) => {
      toast.error('No se pudo eliminar la cita')
      console.error(error)
    },
  })

  const handleSaveAppointmentChanges = () => {
    if (!selectedAppointment?.id) return
    if (!appointmentForm.date || !appointmentForm.time) {
      toast.error('Fecha y hora son obligatorias para guardar cambios.')
      return
    }

    const confirmed = window.confirm(
      '¿Seguro que deseas guardar estas modificaciones en la cita?'
    )
    if (!confirmed) return

    updateAppointmentMutation.mutate({
      id: selectedAppointment.id,
      patch: {
        appointment_date: `${appointmentForm.date}T${appointmentForm.time}:00`,
        location: appointmentForm.location,
        status: appointmentForm.status,
      },
    })
    setIsEditingAppointment(false)
  }

  const handleCancelAppointment = () => {
    const run = async () => {
      if (!selectedAppointment?.id) return
      const confirmed = window.confirm(
        '¿Seguro que deseas cancelar esta cita?'
      )
      if (!confirmed) return

      try {
        const details = parseAppointmentNotes(selectedAppointment.notes)
        const calendarResponse = await fetch('/api/google-calendar/events/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: details.calendarEventId || '',
            appointmentId: selectedAppointment.id,
            source: details.calendarSource || '',
          }),
        })
        if (!calendarResponse.ok) {
          const payload = await calendarResponse.json().catch(() => ({}))
          throw new Error(payload?.error || 'No se pudo eliminar la cita del calendario.')
        }

        await updateAppointmentMutation.mutateAsync({
          id: selectedAppointment.id,
          patch: {
            status: 'cancelled',
          },
        })
      } catch (error) {
        toast.error(error.message || 'No se pudo cancelar la cita')
      }
    }
    run()
  }

  const handleDeleteAppointment = () => {
    const run = async () => {
      if (!selectedAppointment?.id) return
      const confirmed = window.confirm(
        '¿Seguro que deseas eliminar esta cita? Esta acción no se puede deshacer.'
      )
      if (!confirmed) return

      try {
        const details = parseAppointmentNotes(selectedAppointment.notes)
        const calendarResponse = await fetch('/api/google-calendar/events/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: details.calendarEventId || '',
            appointmentId: selectedAppointment.id,
            source: details.calendarSource || '',
          }),
        })
        if (!calendarResponse.ok) {
          const payload = await calendarResponse.json().catch(() => ({}))
          throw new Error(payload?.error || 'No se pudo eliminar la cita del calendario.')
        }

        await deleteAppointmentMutation.mutateAsync(selectedAppointment.id)
      } catch (error) {
        toast.error(error.message || 'No se pudo eliminar la cita')
      }
    }
    run()
  }

  const getAdminAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token || null
  }

  const googleCalendarQuery = useQuery({
    queryKey: ['admin-google-calendar-status'],
    queryFn: async () => {
      const token = await getAdminAuthToken()
      if (!token) {
        return {
          connected: false,
          error: 'No hay sesión admin activa para validar Google Calendar.',
        }
      }

      const response = await fetch('/api/google-calendar/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          connected: false,
          error: data?.error || 'No se pudo obtener estado de Google Calendar.',
        }
      }

      return data
    },
    retry: false,
  })

  const handleConnectGoogleCalendar = async () => {
    try {
      setCalendarActionLoading(true)
      const token = await getAdminAuthToken()
      if (!token) {
        setCalendarNotice('No hay sesión admin activa para iniciar OAuth.')
        setCalendarActionLoading(false)
        return
      }
      const response = await fetch('/api/google-calendar/oauth/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnTo: `${window.location.pathname}${window.location.search}`,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'No se pudo iniciar conexión con Google Calendar.')
      }
      window.location.assign(data.url)
    } catch (error) {
      setCalendarNotice(error.message || 'Error iniciando Google OAuth.')
      setCalendarActionLoading(false)
    }
  }

  const handleDisconnectGoogleCalendar = async () => {
    try {
      setCalendarActionLoading(true)
      const token = await getAdminAuthToken()
      if (!token) {
        setCalendarNotice('No hay sesión admin activa para desconectar Google Calendar.')
        setCalendarActionLoading(false)
        return
      }
      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo desconectar Google Calendar.')
      }
      setCalendarNotice('Google Calendar desconectado.')
      await googleCalendarQuery.refetch()
    } catch (error) {
      setCalendarNotice(error.message || 'No se pudo desconectar Google Calendar.')
    } finally {
      setCalendarActionLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('googleCalendar')
    if (state === 'connected') {
      setCalendarNotice('Google Calendar sincronizado correctamente.')
      googleCalendarQuery.refetch()
      params.delete('googleCalendar')
      const next = params.toString()
      window.history.replaceState({}, '', next ? `${window.location.pathname}?${next}` : window.location.pathname)
      return
    }
    if (state === 'error') {
      setCalendarNotice('No se pudo completar la conexión con Google Calendar.')
      params.delete('googleCalendar')
      const next = params.toString()
      window.history.replaceState({}, '', next ? `${window.location.pathname}?${next}` : window.location.pathname)
    }
  }, [googleCalendarQuery.refetch])

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [servicesRes, promotionsRes, appointmentsRes] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase
          .from('appointments')
          .select('id, appointment_date, status, location, notes, created_at, services(name, price)')
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
      <div className="container py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink-dark mb-2">Panel de Administración</h1>
            <p className="text-ink-light">Bienvenido al panel de control</p>
          </div>
          <Link
            to="/"
            className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center w-full sm:w-auto"
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

        <div className="bg-white rounded-lg p-6 shadow-md mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="font-serif text-xl text-ink-dark">Google Calendar</h2>
              <p className="text-sm text-ink-light mt-1">
                Solo administradores pueden sincronizar la cuenta de calendario usada por todo el sitio.
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                googleCalendarQuery.data?.connected && googleCalendarQuery.data?.canWriteEvents !== false
                  ? 'bg-success/20 text-success'
                  : 'bg-gold/20 text-gold'
              }`}
            >
              {googleCalendarQuery.data?.connected
                ? googleCalendarQuery.data?.canWriteEvents === false
                  ? 'Conectado (solo lectura)'
                  : 'Conectado'
                : 'No conectado'}
            </span>
          </div>

          <div className="text-sm text-ink-light space-y-1">
            <p>
              Cuenta:{' '}
              <span className="text-ink-dark font-medium">
                {googleCalendarQuery.data?.connectedEmail || 'Sin cuenta enlazada'}
              </span>
            </p>
            {googleCalendarQuery.data?.updatedAt && (
              <p>
                Última sincronización:{' '}
                <span className="text-ink-dark font-medium">
                  {new Date(googleCalendarQuery.data.updatedAt).toLocaleString('es-ES')}
                </span>
              </p>
            )}
          </div>

          {googleCalendarQuery.data?.error && (
            <p className="text-sm text-error mt-3">
              {googleCalendarQuery.data.error}
            </p>
          )}
          {googleCalendarQuery.data?.connected && googleCalendarQuery.data?.canWriteEvents === false && (
            <p className="text-sm text-error mt-3">
              La cuenta está en modo solo lectura. Haz click en Re-sincronizar para permitir crear eventos.
            </p>
          )}
          {calendarNotice && <p className="text-sm text-gold mt-3">{calendarNotice}</p>}

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              type="button"
              onClick={handleConnectGoogleCalendar}
              disabled={calendarActionLoading}
              className="btnPrimary px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wider disabled:opacity-60"
            >
              {googleCalendarQuery.data?.connected ? 'Re-sincronizar' : 'Conectar Google'}
            </button>
            {googleCalendarQuery.data?.connected && (
              <button
                type="button"
                onClick={handleDisconnectGoogleCalendar}
                disabled={calendarActionLoading}
                className="px-5 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-ink hover:text-ink transition-colors disabled:opacity-60"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        {stats?.upcomingAppointments && stats.upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="font-serif text-xl text-ink-dark mb-4">Próximas Citas</h2>
            <div className="space-y-3">
              {stats.upcomingAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  onClick={() => openAppointmentDetail(appointment)}
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-md hover:border-gold/50 hover:bg-linen/30 transition-colors"
                  type="button"
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
                    <p className="text-sm text-ink-light capitalize">{statusLabels[appointment.status] || appointment.status}</p>
                    {appointment.services?.name && (
                      <p className="text-xs text-ink-light mt-1">{appointment.services.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        appointment.status === 'confirmed'
                          ? 'bg-success/20 text-success'
                          : appointment.status === 'pending'
                          ? 'bg-gold/20 text-gold'
                          : 'bg-ink-light/20 text-ink-light'
                      }`}
                    >
                      {statusLabels[appointment.status] || appointment.status}
                    </span>
                    <span className="text-xs text-gold font-semibold">Ver detalle</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedAppointment && (
          <div
            className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setSelectedAppointment(null)
              setIsEditingAppointment(false)
            }}
          >
            <div
              className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-border p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl text-ink-dark">Detalle de Cita</h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAppointment(null)
                    setIsEditingAppointment(false)
                  }}
                  className="text-ink-light hover:text-ink text-2xl leading-none"
                  aria-label="Cerrar detalle"
                >
                  &times;
                </button>
              </div>

              {(() => {
                const details = parseAppointmentNotes(selectedAppointment.notes)
                return (
                  <div className="space-y-4 text-sm">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-ink-light">Servicio</p>
                        <p className="text-ink-dark font-semibold">
                          {selectedAppointment.services?.name || 'Servicio no disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-light">Estado</p>
                        {isEditingAppointment ? (
                          <select
                            value={appointmentForm.status}
                            onChange={(event) =>
                              setAppointmentForm((prev) => ({ ...prev, status: event.target.value }))
                            }
                            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold text-ink-dark"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="confirmed">Confirmada</option>
                            <option value="completed">Completada</option>
                            <option value="cancelled">Cancelada</option>
                          </select>
                        ) : (
                          <p className="text-ink-dark font-semibold">
                            {statusLabels[selectedAppointment.status] || selectedAppointment.status}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-ink-light">Fecha y hora</p>
                        {isEditingAppointment ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="date"
                              value={appointmentForm.date}
                              onChange={(event) =>
                                setAppointmentForm((prev) => ({ ...prev, date: event.target.value }))
                              }
                              className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold text-ink-dark"
                            />
                            <input
                              type="time"
                              value={appointmentForm.time}
                              onChange={(event) =>
                                setAppointmentForm((prev) => ({ ...prev, time: event.target.value }))
                              }
                              className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold text-ink-dark"
                            />
                          </div>
                        ) : (
                          <p className="text-ink-dark font-semibold">
                            {new Date(selectedAppointment.appointment_date).toLocaleString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-ink-light">Ubicación</p>
                        {isEditingAppointment ? (
                          <select
                            value={appointmentForm.location}
                            onChange={(event) =>
                              setAppointmentForm((prev) => ({ ...prev, location: event.target.value }))
                            }
                            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold text-ink-dark"
                          >
                            <option value="local">En local</option>
                            <option value="domicilio">A domicilio</option>
                          </select>
                        ) : (
                          <p className="text-ink-dark font-semibold capitalize">
                            {selectedAppointment.location === 'domicilio' ? 'A domicilio' : 'En local'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <p className="text-ink-light mb-2">Datos de contacto</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-ink-light">Nombre</p>
                          <p className="text-ink-dark">{details.fullName || 'No indicado'}</p>
                        </div>
                        <div>
                          <p className="text-ink-light">Email</p>
                          <p className="text-ink-dark">{details.email || 'No indicado'}</p>
                        </div>
                        <div>
                          <p className="text-ink-light">Teléfono</p>
                          <p className="text-ink-dark">{details.phone || 'No indicado'}</p>
                        </div>
                        <div>
                          <p className="text-ink-light">Método de contacto</p>
                          <p className="text-ink-dark">{details.contactMethod || 'No indicado'}</p>
                        </div>
                      </div>
                    </div>

                    {(details.address || details.mainGoal || details.additionalNotes || details.promotion) && (
                      <div className="pt-2 border-t border-border space-y-2">
                        {details.address && (
                          <div>
                            <p className="text-ink-light">Dirección</p>
                            <p className="text-ink-dark">{details.address}</p>
                          </div>
                        )}
                        {details.mainGoal && (
                          <div>
                            <p className="text-ink-light">Objetivo principal</p>
                            <p className="text-ink-dark">{details.mainGoal}</p>
                          </div>
                        )}
                        {details.additionalNotes && (
                          <div>
                            <p className="text-ink-light">Notas adicionales</p>
                            <p className="text-ink-dark">{details.additionalNotes}</p>
                          </div>
                        )}
                        {details.promotion && (
                          <div>
                            <p className="text-ink-light">Promoción</p>
                            <p className="text-ink-dark">{details.promotion}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3">
                      {isEditingAppointment ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSaveAppointmentChanges}
                            disabled={updateAppointmentMutation.isPending}
                            className="btnPrimary px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider disabled:opacity-60"
                          >
                            Guardar Cambios
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingAppointment(false)
                              setAppointmentForm({
                                date: toDateInputValue(selectedAppointment.appointment_date),
                                time: toTimeInputValue(selectedAppointment.appointment_date),
                                location: selectedAppointment.location || 'local',
                                status: selectedAppointment.status || 'pending',
                              })
                            }}
                            className="px-5 py-2 border border-border-md rounded-md text-xs font-semibold uppercase tracking-wider hover:border-ink hover:text-ink transition-colors"
                          >
                            Descartar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditingAppointment(true)}
                            className="btnPrimary px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider"
                          >
                            Editar Cita
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelAppointment}
                            disabled={updateAppointmentMutation.isPending}
                            className="px-5 py-2 border border-gold/40 rounded-md text-xs font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors disabled:opacity-60"
                          >
                            Cancelar Cita
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteAppointment}
                            disabled={deleteAppointmentMutation.isPending}
                            className="px-5 py-2 border border-error/40 rounded-md text-xs font-semibold uppercase tracking-wider text-error hover:bg-error/10 transition-colors disabled:opacity-60"
                          >
                            Eliminar Cita
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
