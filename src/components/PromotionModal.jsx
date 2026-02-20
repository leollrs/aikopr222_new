import { useEffect, useState } from 'react'
import { formatUsd, getDiscountedPrice, toNumber } from '../lib/pricing'

export default function PromotionModal({ highlights, initialIndex = 0, isOpen, onClose, onBook }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const total = highlights.length
  const activeItem = highlights[activeIndex] || null

  useEffect(() => {
    if (!isOpen) return
    const startIndex = Math.min(initialIndex, Math.max(0, total - 1))
    setActiveIndex(startIndex)
  }, [isOpen, initialIndex, total])

  useEffect(() => {
    if (!isOpen || total <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total)
    }, 5000)
    return () => clearInterval(timer)
  }, [isOpen, total])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !activeItem) return null

  const isPromotion = activeItem.type === 'promotion'
  const promotion = isPromotion ? activeItem.promotion : null
  const service = isPromotion ? promotion?.services : activeItem.service

  const title = isPromotion ? promotion?.title : service?.name
  const description = isPromotion ? promotion?.description : service?.description
  const image = isPromotion ? promotion?.banner_image_url || service?.image_url : service?.image_url
  const badge = isPromotion
    ? promotion?.discount_percent
      ? `${promotion.discount_percent}% OFF`
      : `$${promotion?.discount_amount} OFF`
    : 'Servicio Destacado'

  const basePrice = toNumber(service?.price)
  const discountedPrice = isPromotion
    ? getDiscountedPrice(basePrice, promotion?.discount_percent, promotion?.discount_amount)
    : basePrice
  const hasDiscountedPrice =
    isPromotion &&
    basePrice !== null &&
    discountedPrice !== null &&
    discountedPrice < basePrice

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[88vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-light">
              {isPromotion ? 'Promoción Activa' : 'Servicio Destacado'}
            </p>
            <h3 className="font-serif text-xl sm:text-2xl text-ink-dark">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-ink-light hover:text-ink leading-none w-9 h-9 rounded-full hover:bg-bg-alt transition-colors"
            aria-label="Cerrar destacado"
          >
            &times;
          </button>
        </div>

        {image && (
          <img
            src={image}
            alt={title}
            className="w-full h-52 md:h-56 object-cover border-b border-border"
          />
        )}

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full luxuryBadge text-xs uppercase tracking-wider font-semibold">
              {badge}
            </span>
            {isPromotion && (
              <span className="text-sm text-ink-light">
                Vigente hasta {new Date(promotion.end_date).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>

          {basePrice !== null && (
            <div className="mb-4">
              {hasDiscountedPrice ? (
                <p className="text-base flex items-center gap-2">
                  <span className="text-ink-light line-through">{formatUsd(basePrice)}</span>
                  <span className="text-gold font-semibold">{formatUsd(discountedPrice)}</span>
                </p>
              ) : (
                <p className="text-base text-gold font-semibold">{formatUsd(basePrice)}</p>
              )}
            </div>
          )}

          <p className="text-ink-light leading-relaxed mb-6">{description}</p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <button
              onClick={() => {
                onClose()
                onBook(activeItem)
              }}
              className="btnPrimary w-full sm:w-auto px-6 py-3 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all"
            >
              {isPromotion ? 'Agendar con esta promo' : 'Agendar este servicio'}
            </button>

            {total > 1 && (
              <div className="flex items-center gap-2">
                {highlights.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === activeIndex ? 'bg-gold scale-110' : 'bg-border-md'
                    }`}
                    aria-label={`Ver destacado ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
