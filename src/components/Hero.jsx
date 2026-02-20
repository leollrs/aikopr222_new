import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import PromotionModal from './PromotionModal'
import { formatUsd, getDiscountedPrice, toNumber } from '../lib/pricing'
import heroImage from '../assets/hero-image.webp'

export default function Hero({ onOpenModal }) {
  const revealRefs = useRef([])
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false)
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0)
  const [modalInitialIndex, setModalInitialIndex] = useState(0)

  const { data: promotions = [] } = useQuery({
    queryKey: ['hero-promotions'],
    queryFn: async () => {
      const primary = await supabase
        .from('promotions')
        .select('*, services(name, price, image_url)')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (!primary.error) {
        return primary.data || []
      }

      // Backward compatibility: DB without service_id relation still shows promotions.
      const fallback = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (fallback.error) throw fallback.error
      return fallback.data || []
    },
  })

  const { data: featuredService = null } = useQuery({
    queryKey: ['hero-featured-service'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data || null
    },
  })

  const highlightItems = useMemo(() => {
    const items = []
    if (featuredService) {
      items.push({
        id: `service-${featuredService.id}`,
        type: 'service',
        service: featuredService,
      })
    }

    promotions.forEach((promotion) => {
      items.push({
        id: `promotion-${promotion.id}`,
        type: 'promotion',
        promotion,
      })
    })

    return items
  }, [featuredService, promotions])

  const activeHighlight = highlightItems[activeHighlightIndex] || null

  useEffect(() => {
    if (highlightItems.length === 0) {
      setActiveHighlightIndex(0)
      return
    }
    if (activeHighlightIndex > highlightItems.length - 1) {
      setActiveHighlightIndex(0)
    }
  }, [highlightItems.length, activeHighlightIndex])

  useEffect(() => {
    if (highlightItems.length <= 1) return
    const timer = setInterval(() => {
      setActiveHighlightIndex((prev) => (prev + 1) % highlightItems.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [highlightItems.length])

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

  const openHighlightModal = () => {
    setModalInitialIndex(activeHighlightIndex)
    setIsPromotionModalOpen(true)
  }

  const renderHighlightCard = () => {
    if (!activeHighlight) return null

    if (activeHighlight.type === 'promotion') {
      const promotion = activeHighlight.promotion
      const badgeText = promotion.discount_percent
        ? `${promotion.discount_percent}% OFF`
        : `$${promotion.discount_amount} OFF`
      const basePrice = toNumber(promotion?.services?.price)
      const discountedPrice = getDiscountedPrice(
        basePrice,
        promotion?.discount_percent,
        promotion?.discount_amount
      )
      const hasDiscount = basePrice !== null && discountedPrice !== null && discountedPrice < basePrice
      const image = promotion.banner_image_url || promotion?.services?.image_url || null

      return (
        <>
          {image && (
            <img
              src={image}
              alt={promotion.title}
              className="w-full h-40 sm:h-52 object-cover rounded-md mb-4 border border-border"
            />
          )}
          <div className="flex-1">
            <p className="heroCardEyebrow text-[11px] uppercase tracking-wider mb-1">Promocion Activa</p>
            <h3 className="heroCardTitle font-serif text-2xl sm:text-3xl leading-tight mb-2">
              {promotion.title}
            </h3>
            <div className="luxuryBadge px-2.5 py-1 mb-3">
              {badgeText}
            </div>
            {hasDiscount && (
              <div className="flex items-center gap-2 mb-3">
                <span className="heroCardPriceOriginal line-through">{formatUsd(basePrice)}</span>
                <span className="heroCardPrice font-semibold">{formatUsd(discountedPrice)}</span>
              </div>
            )}
            <p className="heroCardBody text-sm mb-4">{promotion.description}</p>
          </div>
        </>
      )
    }

    const service = activeHighlight.service
    return (
      <>
        {service.image_url && (
          <img
            src={service.image_url}
            alt={service.name}
            className="w-full h-40 sm:h-52 object-cover rounded-md mb-4 border border-border"
          />
        )}
        <div className="flex-1">
          <p className="heroCardEyebrow text-[11px] uppercase tracking-wider mb-1">Servicio Destacado</p>
          <h3 className="heroCardTitle font-serif text-2xl sm:text-3xl leading-tight mb-2">
            {service.name}
          </h3>
          <div className="luxuryBadge px-2.5 py-1 mb-3">
            {formatUsd(service.price)}
          </div>
          <p className="heroCardBody text-sm mb-4">{service.description}</p>
        </div>
      </>
    )
  }

  return (
    <section id="home" className="relative min-h-[100svh] flex items-center pt-16 sm:pt-0">
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Sala de tratamiento estético con tecnología láser y ambiente premium"
          className="w-full h-full object-cover heroImageDarkTone"
          fetchPriority="high"
        />
        <div className="absolute inset-0 heroOverlay"></div>
      </div>

      <div className="container relative z-10 py-14 sm:py-20 md:py-32">
        <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)] gap-6 sm:gap-8 lg:gap-10 items-start">
          <div className="max-w-2xl">
            <p
              ref={(el) => (revealRefs.current[0] = el)}
              className="reveal text-sm uppercase tracking-wider text-white/70 mb-4"
            >
              Puerto Rico
            </p>
            <h1
              ref={(el) => (revealRefs.current[1] = el)}
              className="reveal font-serif text-4xl sm:text-5xl md:text-6xl text-white mb-4 leading-tight"
            >
              Experiencia Clínica de Lujo,<br />Resultados Visibles
            </h1>
            <p
              ref={(el) => (revealRefs.current[2] = el)}
              className="reveal text-lg sm:text-xl text-white/90 mb-6"
            >
              Tratamientos Estéticos Avanzados a Domicilio
            </p>
            <p
              ref={(el) => (revealRefs.current[3] = el)}
              className="reveal text-white/80 mb-8 leading-relaxed"
            >
              Protocolos profesionales y tecnología láser para realzar tu belleza natural — desde
              la comodidad de tu hogar.
            </p>

            <div ref={(el) => (revealRefs.current[4] = el)} className="reveal">
              <div className="flex flex-wrap gap-3 sm:gap-4 mb-8">
                <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm text-white border border-white/20">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Tratamientos Certificados
                </span>
                <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm text-white border border-white/20">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  Atención 1:1
                </span>
                <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm text-white border border-white/20">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Equipo Profesional
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={onOpenModal}
                  className="btnPrimary w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4 text-sm"
                >
                  Agendar Cita
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
                <a
                  href="#services"
                  className="btnSecondary w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4 text-sm bg-[var(--surface)] backdrop-blur-sm"
                >
                  Ver Servicios
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </a>
                <a
                  href="tel:+17866729528"
                  className="btnSecondary w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4 text-sm bg-[var(--surface)] backdrop-blur-sm"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  Llamar Ahora
                </a>
              </div>
            </div>
          </div>

          {activeHighlight && (
          <aside className="w-full lg:max-w-[460px] lg:justify-self-end lg:mt-4 lg:min-h-[50vh]">
              <div className="heroCard w-full h-full bg-[rgba(246,241,234,0.9)] transition-all flex flex-col p-4 sm:p-7">
                <button onClick={openHighlightModal} className="text-left flex-1">
                  {renderHighlightCard()}
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider heroCardTitle font-semibold mt-3">
                    {highlightItems.length > 1 ? 'Ver Destacados' : 'Ver Detalles'}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>

                {highlightItems.length > 1 && (
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-border">
                    {highlightItems.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveHighlightIndex(index)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          index === activeHighlightIndex ? 'bg-gold scale-110' : 'bg-ink/20'
                        }`}
                        aria-label={`Ver destacado ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      <PromotionModal
        highlights={highlightItems}
        initialIndex={modalInitialIndex}
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        onBook={(item) => {
          if (item.type === 'promotion') {
            onOpenModal(item.promotion?.service_id || null, item.promotion)
            return
          }
          onOpenModal(item.service?.id || null, null)
        }}
      />
    </section>
  )
}
