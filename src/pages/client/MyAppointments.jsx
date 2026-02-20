import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function ClientAppointments() {
  const { user } = useAuth()
  const [filterStatus, setFilterStatus] = useState('all')
  const queryClient = useQueryClient()

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['client-appointments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, services(name, price, image_url, description)')
        .eq('client_id', user?.id)
        .order('appointment_date', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('client_id', user?.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client-appointments'])
      toast.success('Cita cancelada')
    },
    onError: (error) => {
      toast.error('Error al cancelar cita')
      console.error(error)
    },
  })

  const filteredAppointments = appointments.filter((apt) => {
    if (filterStatus === 'all') return true
    return apt.status === filterStatus
  })

  const handleCancel = (id) => {
    if (confirm('¿Estás seguro de cancelar esta cita?')) {
      cancelMutation.mutate(id)
    }
  }

  const statusLabels = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink-dark mb-2">Mis Citas</h1>
            <p className="text-ink-light">Historial y gestión de tus citas</p>
          </div>
          <Link
            to="/client/dashboard"
            className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center w-full sm:w-auto"
          >
            Volver
          </Link>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md mb-6">
          <label className="block text-sm font-medium text-ink mb-2">Filtrar por estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        {/* Appointments List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-ink-light">Cargando citas...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-ink-light mb-4">No tienes citas {filterStatus !== 'all' && `con estado "${statusLabels[filterStatus]}"`}</p>
            <a
              href="/"
              className="inline-block btnPrimary px-6 py-2 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all"
            >
              Agendar Nueva Cita
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => {
              const isPast = new Date(appointment.appointment_date) < new Date()
              const canCancel = !isPast && appointment.status !== 'cancelled' && appointment.status !== 'completed'

              return (
                <div
                  key={appointment.id}
                  className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col md:flex-row gap-5 sm:gap-6">
                    {appointment.services?.image_url && (
                      <img
                        src={appointment.services.image_url}
                        alt={appointment.services.name}
                        className="w-full md:w-32 h-32 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-serif text-xl text-ink-dark mb-1">
                            {appointment.services?.name || 'Servicio'}
                          </h3>
                          <p className="text-ink-light text-sm mb-2">
                            {appointment.services?.description}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold uppercase whitespace-nowrap ${
                            appointment.status === 'confirmed'
                              ? 'bg-success/20 text-success'
                              : appointment.status === 'completed'
                              ? 'bg-ink-light/20 text-ink-light'
                              : appointment.status === 'cancelled'
                              ? 'bg-error/20 text-error'
                              : 'bg-gold/20 text-gold'
                          }`}
                        >
                          {statusLabels[appointment.status]}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-light">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="text-ink">
                            {new Date(appointment.appointment_date).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-light">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="text-ink capitalize">
                            {appointment.location === 'domicilio' ? 'A domicilio' : 'En local'}
                          </span>
                        </div>
                        {appointment.services?.price && (
                          <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-light">
                              <line x1="12" y1="1" x2="12" y2="23" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <span className="text-ink font-semibold text-gold">
                              ${appointment.services.price}
                            </span>
                          </div>
                        )}
                      </div>
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(appointment.id)}
                          className="mt-4 px-4 py-2 border border-error/30 text-error rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-error/10 transition-colors"
                        >
                          Cancelar Cita
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
