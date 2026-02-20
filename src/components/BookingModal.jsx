import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { formatUsd, getDiscountedPrice, toNumber } from '../lib/pricing'

const BUSINESS_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_LABEL = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

const clampDurationMinutes = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 60
  return Math.min(Math.max(Math.round(minutes), 15), 8 * 60)
}

const parseServiceDurationMinutes = (rawDuration) => {
  if (rawDuration === null || rawDuration === undefined || rawDuration === '') return 60
  if (typeof rawDuration === 'number') return clampDurationMinutes(rawDuration)

  const text = String(rawDuration).trim().toLowerCase()
  if (!text) return 60

  const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hora|horas)/)
  const minuteMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(m|min|mins|minuto|minutos)/)
  if (hourMatch || minuteMatch) {
    const hours = hourMatch ? Number.parseFloat(hourMatch[1].replace(',', '.')) : 0
    const minutes = minuteMatch ? Number.parseFloat(minuteMatch[1].replace(',', '.')) : 0
    const combined = hours * 60 + minutes
    if (combined > 0) return clampDurationMinutes(combined)
  }

  const numericParts = (text.match(/\d+(?:[.,]\d+)?/g) || [])
    .map((value) => Number.parseFloat(value.replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!numericParts.length) return 60

  const hasRange = text.includes('-') || text.includes('–')
  const base = hasRange ? Math.max(...numericParts) : numericParts[0]
  if (text.includes('h') || text.includes('hora')) return clampDurationMinutes(base * 60)
  return clampDurationMinutes(base)
}

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateKey = (value) => {
  const [yearRaw, monthRaw, dayRaw] = String(value || '').split('-')
  const year = Number.parseInt(yearRaw, 10)
  const month = Number.parseInt(monthRaw, 10)
  const day = Number.parseInt(dayRaw, 10)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const buildCalendarDays = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: toDateKey(date),
      date,
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
    }
  })
}

const formatTimeForWebhook = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return ''
  const [hoursRaw, minutesRaw = '00'] = timeValue.split(':')
  const hours = Number.parseInt(hoursRaw, 10)
  const minutes = Number.parseInt(minutesRaw, 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

export default function BookingModal({ onClose, serviceId, promotion }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [selectedPromotion, setSelectedPromotion] = useState(() => {
    if (promotion?.service_id && promotion.service_id === serviceId) return promotion
    return null
  })
  const [formData, setFormData] = useState({
    service: serviceId || '',
    location: 'domicilio',
    date: '',
    time: '',
    name: '',
    email: '',
    phone: '',
    contactMethod: 'whatsapp',
    address: '',
    mainGoal: '',
    additionalNotes: '',
  })
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const initial = startOfDay(new Date())
    initial.setDate(1)
    return initial
  })
  const [availableTimes, setAvailableTimes] = useState(BUSINESS_HOURS)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState('')

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      return data || []
    },
  })
  const { data: bookingProfile } = useQuery({
    queryKey: ['booking-client-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('full_name, phone, address')
        .eq('user_id', user?.id)
        .maybeSingle()

      if (error) throw error
      return data || null
    },
    enabled: !!user?.id,
  })

  const selectedServiceIds = String(formData.service || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id))
  const selectedService = selectedServices[0] || null
  const totalDurationMinutes = selectedServices.length
    ? selectedServices.reduce((sum, service) => sum + parseServiceDurationMinutes(service.duration), 0)
    : 60
  const serviceNamesText = selectedServices.length
    ? selectedServices.map((service) => service.name).join(' + ')
    : selectedService?.name || ''

  useEffect(() => {
    if (promotion?.service_id && promotion.service_id === serviceId) {
      setSelectedPromotion(promotion)
      return
    }
    setSelectedPromotion(null)
  }, [promotion, serviceId])

  useEffect(() => {
    if (!user?.id) return
    setFormData((prev) => ({
      ...prev,
      email: prev.email || user.email || '',
    }))
  }, [user?.id, user?.email])

  useEffect(() => {
    if (!bookingProfile) return
    setFormData((prev) => ({
      ...prev,
      name: prev.name || bookingProfile.full_name || '',
      phone: prev.phone || bookingProfile.phone || '',
      address: prev.address || bookingProfile.address || '',
    }))
  }, [bookingProfile])

  useEffect(() => {
    if (!selectedPromotion) return
    if (!selectedServiceIds.includes(selectedPromotion.service_id)) {
      setSelectedPromotion(null)
    }
  }, [selectedPromotion, selectedServiceIds])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'date' ? { time: '' } : {}),
      ...(name === 'location' && value !== 'domicilio' ? { address: '' } : {}),
    }))
  }

  const handleToggleService = (serviceIdToToggle) => {
    setFormData((prev) => {
      const currentIds = String(prev.service || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      const exists = currentIds.includes(serviceIdToToggle)
      const nextIds = exists
        ? currentIds.filter((value) => value !== serviceIdToToggle)
        : [...currentIds, serviceIdToToggle]

      return {
        ...prev,
        service: nextIds.join(','),
      }
    })
  }

  const handleSelectCalendarDate = (date) => {
    const key = toDateKey(date)
    setFormData((prev) => ({
      ...prev,
      date: key,
      time: '',
    }))
  }

  const goToPreviousMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const fetchAvailabilityForDate = async (date, time = '', durationMinutes = totalDurationMinutes) => {
    const params = new URLSearchParams({ date })
    if (time) params.set('time', time)
    params.set('durationMinutes', String(clampDurationMinutes(durationMinutes)))
    const response = await fetch(`/api/availability?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`availability request failed: ${response.status}`)
    }
    return response.json()
  }

  useEffect(() => {
    if (!formData.date) {
      setAvailableTimes(BUSINESS_HOURS)
      setAvailabilityMessage('')
      return
    }

    let isCurrent = true
    setIsLoadingAvailability(true)
    setAvailabilityMessage('')

    fetchAvailabilityForDate(formData.date, '', totalDurationMinutes)
      .then((data) => {
        if (!isCurrent) return
        const slots = Array.isArray(data?.availableSlots) ? data.availableSlots : BUSINESS_HOURS
        setAvailableTimes(slots)

        if (formData.time && !slots.includes(formData.time)) {
          setFormData((prev) => ({ ...prev, time: '' }))
        }

        if (data?.configured === false) {
          setAvailabilityMessage('Mostrando horario de referencia. Falta configurar Google Calendar en servidor.')
          return
        }
        if (slots.length === 0) {
          setAvailabilityMessage('No hay horarios disponibles para esa fecha.')
        }
      })
      .catch((error) => {
        if (!isCurrent) return
        console.warn('Availability check failed:', error)
        setAvailableTimes(BUSINESS_HOURS)
        setAvailabilityMessage('No se pudo validar disponibilidad en tiempo real. Intenta de nuevo.')
      })
      .finally(() => {
        if (isCurrent) setIsLoadingAvailability(false)
      })

    return () => {
      isCurrent = false
    }
  }, [formData.date, totalDurationMinutes])

  useEffect(() => {
    if (!formData.date) return
    const selectedDate = parseDateKey(formData.date)
    if (!selectedDate) return
    setCalendarViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [formData.date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      let calendarSyncWarning = ''

      if (!selectedServiceIds.length) {
        toast.error('Selecciona al menos un servicio para continuar.')
        setStep(1)
        return
      }

      if (formData.location === 'domicilio' && !formData.address.trim()) {
        toast.error('Para servicio a domicilio necesitamos tu dirección.')
        return
      }

      try {
        const availabilityCheck = await fetchAvailabilityForDate(
          formData.date,
          formData.time,
          totalDurationMinutes
        )
        if (availabilityCheck?.isAvailable === false) {
          toast.error('Esa hora ya no está disponible. Elige otra hora.')
          setStep(2)
          setFormData((prev) => ({ ...prev, time: '' }))
          return
        }
      } catch (availabilityError) {
        console.warn('Could not re-check availability on submit:', availabilityError)
      }

      let clientId = user?.id

      // If user is not logged in, try to find or create client profile
      if (!clientId) {
        // Check if email exists in users table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email)
          .single()

        if (existingUser) {
          clientId = existingUser.id
        } else {
          // For non-authenticated bookings, we'll store contact info in notes
          // The admin can create the user account later if needed
          clientId = null
        }
      }

      // Create appointment
      const totalBasePrice = selectedServices.reduce((sum, service) => {
        const price = toNumber(service?.price)
        return sum + (price ?? 0)
      }, 0)
      const promoService = selectedPromotion
        ? selectedServices.find((service) => service.id === selectedPromotion.service_id)
        : null
      const promoServicePrice = toNumber(promoService?.price)
      const promoApplies =
        Boolean(selectedPromotion?.active) &&
        Boolean(promoService)
      const promoServiceDiscountedPrice = promoApplies
        ? getDiscountedPrice(
            promoServicePrice,
            selectedPromotion.discount_percent,
            selectedPromotion.discount_amount
          )
        : null
      const totalDiscountedPrice =
        promoApplies &&
        promoServicePrice !== null &&
        promoServiceDiscountedPrice !== null &&
        promoServiceDiscountedPrice < promoServicePrice
          ? totalBasePrice - promoServicePrice + promoServiceDiscountedPrice
          : totalBasePrice
      const hasDiscountedPrice = totalDiscountedPrice < totalBasePrice

      let notes = `Cliente: ${formData.name}, Email: ${formData.email}, Tel: ${formData.phone}`
      notes += ` | Método de contacto: ${formData.contactMethod}`
      if (formData.mainGoal.trim()) {
        notes += ` | Objetivo: ${formData.mainGoal.trim()}`
      }
      if (formData.location === 'domicilio' && formData.address.trim()) {
        notes += ` | Dirección: ${formData.address.trim()}`
      }
      if (formData.additionalNotes.trim()) {
        notes += ` | Notas: ${formData.additionalNotes.trim()}`
      }
      notes += ` | Duración total: ${totalDurationMinutes} min`
      if (serviceNamesText) {
        notes += ` | Servicios: ${serviceNamesText}`
      }
      if (promoApplies && hasDiscountedPrice) {
        notes += ` | Promoción: ${selectedPromotion.title} | Precio original: ${formatUsd(totalBasePrice)} | Precio promocional: ${formatUsd(totalDiscountedPrice)}`
      }

      const appointmentData = {
        service_id: selectedServiceIds[0] || formData.service,
        appointment_date: `${formData.date}T${formData.time}:00`,
        location: formData.location,
        status: 'confirmed',
        notes,
      }

      // Only add client_id if user is authenticated
      if (clientId) {
        appointmentData.client_id = clientId
      }

      try {
        const { data: slotConflict, error: slotConflictError } = await supabase
          .from('appointments')
          .select('id')
          .eq('appointment_date', appointmentData.appointment_date)
          .in('status', ['pending', 'confirmed'])
          .limit(1)

        if (!slotConflictError && slotConflict?.length) {
          toast.error('Ya existe una cita para esa fecha y hora. Escoge otro horario.')
          setStep(2)
          return
        }
      } catch (conflictError) {
        console.warn('Local conflict check failed:', conflictError)
      }

      const { data: insertedAppointment, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select('id, appointment_date, created_at')
        .single()

      if (error) throw error

      // If user is logged in, update or create client profile
      if (clientId) {
        const { data: existingProfile } = await supabase
          .from('client_profiles')
          .select('id')
          .eq('user_id', clientId)
          .single()

        if (existingProfile) {
          await supabase
            .from('client_profiles')
            .update({
              full_name: formData.name,
              phone: formData.phone,
              address: formData.address,
            })
            .eq('id', existingProfile.id)
        } else {
          await supabase.from('client_profiles').insert([
            {
              user_id: clientId,
              full_name: formData.name,
              phone: formData.phone,
              address: formData.address,
            },
          ])
        }
      }

      const intakePayload = {
        event: 'intake_submitted',
        lang: 'es',
        formData: {
          fullName: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          serviceName: serviceNamesText || selectedService?.name || '',
          appointmentDate: formData.date,
          appointmentTime: formatTimeForWebhook(formData.time),
          serviceType: formData.location === 'local' ? 'clinic' : 'home',
          address: formData.location === 'domicilio' ? formData.address.trim() : '',
          contactMethod: formData.contactMethod,
          mainGoal: formData.mainGoal.trim(),
          additionalNotes: formData.additionalNotes.trim(),
        },
        meta: {
          source: 'base44',
          ts: new Date().toISOString(),
          requestId: createRequestId(),
          appointmentId: insertedAppointment?.id || null,
          clientId: clientId || null,
          promotionApplied: Boolean(promoApplies && hasDiscountedPrice),
          promotionTitle: promoApplies ? selectedPromotion?.title || null : null,
          basePrice: totalBasePrice,
          discountedPrice: hasDiscountedPrice ? totalDiscountedPrice : null,
          totalDurationMinutes,
        },
      }

      try {
        const calendarResponse = await fetch('/api/google-calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: insertedAppointment?.id || null,
            date: formData.date,
            time: formData.time,
            durationMinutes: totalDurationMinutes,
            serviceNames: selectedServices.map((service) => service.name),
            fullName: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            contactMethod: formData.contactMethod,
            location: formData.location,
            address: formData.location === 'domicilio' ? formData.address.trim() : '',
            mainGoal: formData.mainGoal.trim(),
            additionalNotes: formData.additionalNotes.trim(),
          }),
        })

        if (!calendarResponse.ok) {
          const payload = await calendarResponse.json().catch(() => ({}))
          calendarSyncWarning =
            payload?.error ||
            'La cita se guardó, pero no se pudo sincronizar con Google Calendar.'
          console.warn('Calendar sync failed:', calendarSyncWarning)
        } else {
          const payload = await calendarResponse.json().catch(() => ({}))
          const calendarEventId = String(payload?.eventId || '').trim()
          const calendarSource = String(payload?.source || '').trim()
          if (calendarEventId) {
            const calendarMetaNote = ` | Calendar Event ID: ${calendarEventId}${
              calendarSource ? ` | Calendar Source: ${calendarSource}` : ''
            }`
            await supabase
              .from('appointments')
              .update({
                notes: `${notes}${calendarMetaNote}`,
              })
              .eq('id', insertedAppointment?.id)
          }
        }
      } catch (calendarError) {
        calendarSyncWarning = 'La cita se guardó, pero no se pudo sincronizar con Google Calendar.'
        console.warn('Calendar sync request failed:', calendarError)
      }

      // Do not fail the booking UX if webhook is temporarily unavailable.
      try {
        await fetch('/api/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intakePayload),
        })
      } catch (webhookError) {
        console.warn('Intake webhook failed:', webhookError)
      }

      toast.success('Cita solicitada. Te contactaremos pronto.')
      if (calendarSyncWarning) {
        toast.warning(calendarSyncWarning)
      }
      setStep(4)
    } catch (error) {
      toast.error('Error al reservar cita. Por favor intenta de nuevo.')
      console.error(error)
    }
  }

  const totalBasePrice = selectedServices.reduce((sum, service) => {
    const price = toNumber(service?.price)
    return sum + (price ?? 0)
  }, 0)
  const selectedPromoService = selectedPromotion
    ? selectedServices.find((service) => service.id === selectedPromotion.service_id)
    : null
  const selectedPromoServicePrice = toNumber(selectedPromoService?.price)
  const selectedPromoDiscountedPrice =
    selectedPromotion &&
    selectedPromotion.active &&
    selectedPromoServicePrice !== null
      ? getDiscountedPrice(
          selectedPromoServicePrice,
          selectedPromotion.discount_percent,
          selectedPromotion.discount_amount
        )
      : null
  const selectedServiceDiscountedPrice =
    selectedPromoServicePrice !== null &&
    selectedPromoDiscountedPrice !== null &&
    selectedPromoDiscountedPrice < selectedPromoServicePrice
      ? totalBasePrice - selectedPromoServicePrice + selectedPromoDiscountedPrice
      : totalBasePrice
  const selectedServiceHasDiscount =
    selectedServices.length > 0 && selectedServiceDiscountedPrice < totalBasePrice
  const canContinueStep1 =
    Boolean(formData.service) &&
    (formData.location !== 'domicilio' || formData.address.trim().length > 0)
  const today = startOfDay(new Date())
  const firstAllowedMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const canGoPrevMonth = calendarViewDate > firstAllowedMonth
  const selectedDateObject = parseDateKey(formData.date)
  const calendarDays = buildCalendarDays(calendarViewDate)

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[94vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
          <h2 className="font-serif text-xl sm:text-2xl text-ink-dark">Agenda Tu Experiencia</h2>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink text-2xl leading-none"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {/* Progress */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    step >= s ? 'bg-gold text-white' : 'bg-bg-alt text-ink-light'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-8 sm:w-12 h-0.5 ${step > s ? 'bg-gold' : 'bg-bg-alt'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {step === 4 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 text-gold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-ink-dark mb-2">Solicitud Recibida</h3>
              <p className="text-ink-light mb-6">
                Confirmaremos tu cita por mensaje tan pronto recibamos tu solicitud.
              </p>
              <button
                onClick={onClose}
                className="btnPrimary px-8 py-3 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all"
              >
                Listo
              </button>
            </div>
          ) : (
            <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}>
              {/* Step 1: Service Selection */}
              {step === 1 && (
                <div>
                  <p className="text-ink-light mb-2">Selecciona uno o más tratamientos.</p>
                  <p className="text-xs text-ink-light mb-6">
                    Seleccionados: {selectedServiceIds.length} · Duración total estimada: {totalDurationMinutes} min
                  </p>
                  {selectedPromotion && (
                    <div className="mb-4 p-3 rounded-md border border-gold/30 bg-gold/10">
                      <p className="text-sm text-ink">
                        Promoción aplicada: <span className="font-semibold">{selectedPromotion.title}</span>
                      </p>
                      {selectedServiceHasDiscount && (
                        <p className="text-sm mt-1 flex items-center gap-2">
                          <span className="text-ink-light line-through">
                            {formatUsd(totalBasePrice)}
                          </span>
                          <span className="text-gold font-semibold">
                            {formatUsd(selectedServiceDiscountedPrice)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedServiceIds.includes(service.id)
                            ? 'border-gold bg-gold/5'
                            : 'border-border hover:border-gold/50'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            value={service.id}
                            checked={selectedServiceIds.includes(service.id)}
                            onChange={() => handleToggleService(service.id)}
                            className="mt-1 w-4 h-4 rounded border-border text-gold focus:ring-gold"
                          />
                          <div>
                            <div className="font-semibold text-ink-dark">{service.name}</div>
                            <div className="text-sm text-ink-light">
                              {service.duration || `${parseServiceDurationMinutes(service.duration)} min (estimado)`}
                            </div>
                          </div>
                        </div>
                        {selectedPromotion &&
                        selectedPromotion.service_id === service.id &&
                        selectedPromotion.active &&
                        getDiscountedPrice(
                          service.price,
                          selectedPromotion.discount_percent,
                          selectedPromotion.discount_amount
                        ) <
                          toNumber(service.price) ? (
                          <div className="text-right">
                            <div className="text-xs text-ink-light line-through">
                              {formatUsd(service.price)}
                            </div>
                            <div className="text-gold font-semibold">
                              {formatUsd(
                                getDiscountedPrice(
                                  service.price,
                                  selectedPromotion.discount_percent,
                                  selectedPromotion.discount_amount
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gold font-semibold">{formatUsd(service.price)}</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-ink mb-2">
                      Ubicación del servicio
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <label className="flex-1">
                        <input
                          type="radio"
                          name="location"
                          value="domicilio"
                          checked={formData.location === 'domicilio'}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div
                          className={`p-4 border-2 rounded-lg text-center cursor-pointer transition-all ${
                            formData.location === 'domicilio'
                              ? 'border-gold bg-gold/5'
                              : 'border-border hover:border-gold/50'
                          }`}
                        >
                          A domicilio
                        </div>
                      </label>
                      <label className="flex-1">
                        <input
                          type="radio"
                          name="location"
                          value="local"
                          checked={formData.location === 'local'}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div
                          className={`p-4 border-2 rounded-lg text-center cursor-pointer transition-all ${
                            formData.location === 'local'
                              ? 'border-gold bg-gold/5'
                              : 'border-border hover:border-gold/50'
                          }`}
                        >
                          En local
                        </div>
                      </label>
                    </div>
                    {formData.location === 'domicilio' && (
                      <div className="mt-4">
                        <label htmlFor="address-step1" className="block text-sm font-medium text-ink mb-2">
                          Dirección para servicio a domicilio
                        </label>
                        <input
                          id="address-step1"
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          required={formData.location === 'domicilio'}
                          className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                          placeholder="Ej: Calle, número, urbanización"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => canContinueStep1 && setStep(2)}
                    disabled={!canContinueStep1}
                    className="w-full mt-6 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* Step 2: Date & Time */}
              {step === 2 && (
                <div>
                  <p className="text-ink-light mb-6">Elige tu fecha y hora preferida.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-2">
                        Fecha Preferida
                      </label>
                      <div className="rounded-2xl border border-border bg-linen/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={goToPreviousMonth}
                            disabled={!canGoPrevMonth}
                            className="h-8 w-8 rounded-full border border-border text-ink disabled:opacity-35 disabled:cursor-not-allowed hover:border-gold hover:text-gold transition-colors"
                            aria-label="Mes anterior"
                          >
                            ‹
                          </button>
                          <p className="font-serif text-base sm:text-lg text-ink-dark capitalize">
                            {MONTH_LABEL.format(calendarViewDate)}
                          </p>
                          <button
                            type="button"
                            onClick={goToNextMonth}
                            className="h-8 w-8 rounded-full border border-border text-ink hover:border-gold hover:text-gold transition-colors"
                            aria-label="Mes siguiente"
                          >
                            ›
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {WEEK_DAYS.map((day) => (
                            <span key={day} className="text-[11px] uppercase tracking-wider text-ink-light text-center py-1">
                              {day}
                            </span>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((entry) => {
                            const dayDate = entry.date
                            const isPast = startOfDay(dayDate) < today
                            const isSelected = Boolean(selectedDateObject) && toDateKey(dayDate) === toDateKey(selectedDateObject)
                            const isDisabled = isPast

                            return (
                              <button
                                key={entry.key}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => handleSelectCalendarDate(dayDate)}
                                className={`aspect-square rounded-xl text-sm border transition-colors ${
                                  isSelected
                                    ? 'bg-gold text-white border-gold shadow-[0_10px_24px_rgba(201,174,126,0.35)]'
                                    : entry.inCurrentMonth
                                    ? 'bg-white/80 text-ink border-border hover:border-gold/60'
                                    : 'bg-transparent text-ink-light/40 border-transparent'
                                } ${isDisabled ? 'opacity-35 cursor-not-allowed' : ''}`}
                              >
                                {dayDate.getDate()}
                              </button>
                            )
                          })}
                        </div>

                        <p className="mt-3 text-xs text-ink-light">
                          Duración estimada para esta cita: {totalDurationMinutes} min
                        </p>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="time" className="block text-sm font-medium text-ink mb-2">
                        Hora Preferida
                      </label>
                      <select
                        id="time"
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        required
                        disabled={!formData.date || isLoadingAvailability || availableTimes.length === 0}
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      >
                        <option value="">Selecciona una hora</option>
                        {availableTimes.map((time) => (
                          <option key={time} value={time}>
                            {time === '12:00' ? '12:00 PM' : parseInt(time) < 12 ? `${time} AM` : `${parseInt(time) - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                      {isLoadingAvailability && (
                        <p className="text-xs text-ink-light mt-2">Validando disponibilidad con Google Calendar...</p>
                      )}
                      {!isLoadingAvailability && availabilityMessage && (
                        <p className="text-xs text-ink-light mt-2">{availabilityMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-ink hover:text-ink transition-colors"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => formData.date && formData.time && setStep(3)}
                      disabled={!formData.date || !formData.time}
                      className="flex-1 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Contact Details */}
              {step === 3 && (
                <div>
                  <p className="text-ink-light mb-6">Casi listo. Dinos cómo contactarte.</p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
                        Nombre Completo
                      </label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-ink mb-2">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-ink mb-2">
                        Teléfono
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      />
                    </div>
                    <div>
                      <label htmlFor="contactMethod" className="block text-sm font-medium text-ink mb-2">
                        Método de contacto preferido
                      </label>
                      <select
                        id="contactMethod"
                        name="contactMethod"
                        value={formData.contactMethod}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="call">Llamada</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="mainGoal" className="block text-sm font-medium text-ink mb-2">
                        ¿Cuál es tu objetivo principal?
                      </label>
                      <textarea
                        id="mainGoal"
                        name="mainGoal"
                        value={formData.mainGoal}
                        onChange={handleChange}
                        required
                        rows={3}
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                        placeholder="Ej: mejorar textura, reducir manchas, etc."
                      />
                    </div>
                    <div>
                      <label htmlFor="additionalNotes" className="block text-sm font-medium text-ink mb-2">
                        Notas adicionales (opcional)
                      </label>
                      <textarea
                        id="additionalNotes"
                        name="additionalNotes"
                        value={formData.additionalNotes}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                        placeholder="Comparte cualquier detalle importante para tu cita."
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-ink hover:text-ink transition-colors"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      className="flex-1 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all"
                    >
                      Reservar Mi Cita
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
