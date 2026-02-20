import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { formatUsd, getDiscountedPrice, toNumber } from '../lib/pricing'

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
  })

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

  useEffect(() => {
    if (promotion?.service_id && promotion.service_id === serviceId) {
      setSelectedPromotion(promotion)
      return
    }
    setSelectedPromotion(null)
  }, [promotion, serviceId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (name === 'service' && selectedPromotion?.service_id !== value) {
      setSelectedPromotion(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
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
      const selectedService = services.find((service) => service.id === formData.service)
      const basePrice = toNumber(selectedService?.price)
      const promoApplies =
        selectedPromotion &&
        selectedPromotion.service_id === formData.service &&
        selectedPromotion.active
      const discountedPrice = promoApplies
        ? getDiscountedPrice(
            basePrice,
            selectedPromotion.discount_percent,
            selectedPromotion.discount_amount
          )
        : null
      const hasDiscountedPrice =
        basePrice !== null && discountedPrice !== null && discountedPrice < basePrice

      let notes = `Cliente: ${formData.name}, Email: ${formData.email}, Tel: ${formData.phone}`
      if (promoApplies && hasDiscountedPrice) {
        notes += ` | Promoción: ${selectedPromotion.title} | Precio original: ${formatUsd(basePrice)} | Precio promocional: ${formatUsd(discountedPrice)}`
      }

      const appointmentData = {
        service_id: formData.service,
        appointment_date: `${formData.date}T${formData.time}:00`,
        location: formData.location,
        status: 'pending',
        notes,
      }

      // Only add client_id if user is authenticated
      if (clientId) {
        appointmentData.client_id = clientId
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
            })
            .eq('id', existingProfile.id)
        } else {
          await supabase.from('client_profiles').insert([
            {
              user_id: clientId,
              full_name: formData.name,
              phone: formData.phone,
            },
          ])
        }
      }

      const intakePayload = {
        source: 'web-booking-form',
        appointment_id: insertedAppointment?.id || null,
        client_id: clientId || null,
        submitted_at: new Date().toISOString(),
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
        service: {
          id: formData.service,
          name: selectedService?.name || null,
          location: formData.location,
          requested_date: formData.date,
          requested_time: formData.time,
          appointment_date: insertedAppointment?.appointment_date || null,
        },
        pricing: {
          base_price: basePrice,
          discounted_price: hasDiscountedPrice ? discountedPrice : null,
          promotion_applied: Boolean(promoApplies && hasDiscountedPrice),
          promotion: promoApplies
            ? {
                id: selectedPromotion?.id || null,
                title: selectedPromotion?.title || null,
                discount_percent: selectedPromotion?.discount_percent || null,
                discount_amount: selectedPromotion?.discount_amount || null,
              }
            : null,
        },
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
      setStep(4)
    } catch (error) {
      toast.error('Error al reservar cita. Por favor intenta de nuevo.')
      console.error(error)
    }
  }

  const selectedService = services.find((s) => s.id === formData.service)
  const selectedServiceBasePrice = toNumber(selectedService?.price)
  const selectedServiceDiscountedPrice =
    selectedPromotion &&
    selectedPromotion.service_id === selectedService?.id &&
    selectedPromotion.active
      ? getDiscountedPrice(
          selectedServiceBasePrice,
          selectedPromotion.discount_percent,
          selectedPromotion.discount_amount
        )
      : null
  const selectedServiceHasDiscount =
    selectedServiceBasePrice !== null &&
    selectedServiceDiscountedPrice !== null &&
    selectedServiceDiscountedPrice < selectedServiceBasePrice

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-border p-6 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink-dark">Agenda Tu Experiencia</h2>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink text-2xl leading-none"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step >= s ? 'bg-gold text-white' : 'bg-bg-alt text-ink-light'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-0.5 ${step > s ? 'bg-gold' : 'bg-bg-alt'}`}
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
              <h3 className="font-serif text-2xl text-ink-dark mb-2">Solicitud Recibida</h3>
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
                  <p className="text-ink-light mb-6">Selecciona tu tratamiento preferido.</p>
                  {selectedPromotion && (
                    <div className="mb-4 p-3 rounded-md border border-gold/30 bg-gold/10">
                      <p className="text-sm text-ink">
                        Promoción aplicada: <span className="font-semibold">{selectedPromotion.title}</span>
                      </p>
                      {selectedServiceHasDiscount && (
                        <p className="text-sm mt-1 flex items-center gap-2">
                          <span className="text-ink-light line-through">
                            {formatUsd(selectedServiceBasePrice)}
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
                          formData.service === service.id
                            ? 'border-gold bg-gold/5'
                            : 'border-border hover:border-gold/50'
                        }`}
                      >
                        <div className="flex-1">
                          <input
                            type="radio"
                            name="service"
                            value={service.id}
                            checked={formData.service === service.id}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <div className="font-semibold text-ink-dark">{service.name}</div>
                          {service.duration && (
                            <div className="text-sm text-ink-light">{service.duration}</div>
                          )}
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
                    <div className="flex gap-4">
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
                  </div>
                  <button
                    type="button"
                    onClick={() => formData.service && setStep(2)}
                    disabled={!formData.service}
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
                      <label htmlFor="date" className="block text-sm font-medium text-ink mb-2">
                        Fecha Preferida
                      </label>
                      <input
                        id="date"
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      />
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
                        className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                      >
                        <option value="">Selecciona una hora</option>
                        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(
                          (time) => (
                            <option key={time} value={time}>
                              {time === '12:00' ? '12:00 PM' : parseInt(time) < 12 ? `${time} AM` : `${parseInt(time) - 12}:00 PM`}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6">
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
                  </div>
                  <div className="flex gap-4 mt-6">
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
