import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export default function Services({ onOpenModal }) {
  const revealRefs = useRef([])

  const { data: services = [], isLoading } = useQuery({
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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    )

    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => {
      revealRefs.current.forEach((el) => {
        if (el) observer.unobserve(el)
      })
    }
  }, [])

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = []
    }
    acc[service.category].push(service)
    return acc
  }, {})

  const categoryLabels = {
    'estetica-avanzada': 'Estética Avanzada',
    'domicilio': 'Exclusivos a Domicilio',
    'depilacion': 'Depilación Láser Diodo',
    'faciales': 'Faciales',
  }

  if (isLoading) {
    return (
      <section id="services" className="py-24 bg-bg">
        <div className="container">
          <p className="text-ink-light">Cargando servicios...</p>
        </div>
      </section>
    )
  }

  return (
    <section id="services" className="py-24 bg-bg">
      <div className="container">
        <header className="text-center mb-16">
          <span className="text-xs uppercase tracking-wider text-ink-light mb-2 block">Nuestros Servicios</span>
          <h2 className="font-serif text-4xl md:text-5xl text-ink-dark mb-4">Catálogo de Tratamientos</h2>
          <p className="text-ink-light max-w-2xl mx-auto">
            Protocolos avanzados con tecnología de vanguardia para resultados visibles.
          </p>
        </header>

        {Object.entries(servicesByCategory).map(([category, categoryServices], catIdx) => (
          <div key={category} className="mb-16">
            <h3 className="font-serif text-2xl text-ink-dark mb-2">{categoryLabels[category]}</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {categoryServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
                >
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                  )}
                  <h4 className="font-serif text-xl text-ink-dark mb-2">{service.name}</h4>
                  <p className="text-ink-light text-sm mb-4">{service.description}</p>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gold font-semibold">${service.price}</span>
                    {service.duration && <span className="text-ink-light text-sm">{service.duration}</span>}
                  </div>
                  <button
                    onClick={() => onOpenModal(service.id)}
                    className="w-full py-2 px-4 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
                  >
                    Reservar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="text-center py-12">
            <p className="text-ink-light">No hay servicios disponibles en este momento.</p>
          </div>
        )}
      </div>
    </section>
  )
}
