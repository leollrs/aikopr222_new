import { useEffect, useRef } from 'react'
import experienceImage from '../assets/experience-image.webp'

export default function Experience() {
  const revealRef = useRef(null)

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

    if (revealRef.current) observer.observe(revealRef.current)

    return () => {
      if (revealRef.current) observer.unobserve(revealRef.current)
    }
  }, [])

  return (
    <section id="experience" className="py-16 sm:py-24 bg-bg-alt">
      <div className="container">
        <div ref={revealRef} className="reveal grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <img
              src={experienceImage}
              alt="Kit de tratamiento móvil profesional en ambiente residencial premium"
              className="w-full rounded-lg shadow-lg aspect-[4/3] sm:aspect-auto object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-ink-light mb-2 block">La Experiencia</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-ink-dark mb-5 sm:mb-6">
              Más Que un Tratamiento.<br />Un Ritual.
            </h2>
            <p className="text-ink-light mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
              Desde el momento en que nos contactas, cada detalle está diseñado para brindarte una experiencia premium. Llevamos la clínica a tu hogar con los más altos estándares.
            </p>
            <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <li className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold mt-1 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-ink">Consulta personalizada antes de cada sesión</span>
              </li>
              <li className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold mt-1 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-ink">Equipo clínico profesional y certificado</span>
              </li>
              <li className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold mt-1 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-ink">Tecnología láser de grado médico</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
