import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SubscriptionPromptModal({ isOpen, onClose }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const goToSignUp = () => {
    onClose()
    navigate('/login?mode=signup&source=landing-popup')
  }

  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-[var(--surface-strong)] backdrop-blur-xl p-6 sm:p-8 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full text-ink-light hover:text-ink hover:bg-bg-alt transition-colors"
          aria-label="Cerrar aviso"
        >
          &times;
        </button>

        <p className="text-xs uppercase tracking-[0.2em] text-ink-light mb-2">Comunidad AIKOPR222</p>
        <h3 className="font-serif text-3xl text-ink-dark mb-3">Recibe ofertas exclusivas</h3>
        <p className="text-ink-light leading-relaxed mb-7">
          Crea tu cuenta para enterarte primero de promociones, lanzamientos y noticias de
          tratamientos.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={goToSignUp} className="btnPrimary px-6 py-3 text-sm">
            Crear Cuenta
          </button>
          <button type="button" onClick={onClose} className="btnSecondary px-6 py-3 text-sm">
            Ahora No
          </button>
        </div>
      </div>
    </div>
  )
}
