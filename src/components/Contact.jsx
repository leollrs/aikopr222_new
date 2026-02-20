import { useEffect, useRef } from 'react'
import contactCtaImage from '../assets/contact-cta-image.png'

export default function Contact() {
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
    <section id="contact" className="py-16 sm:py-24 bg-bg-alt">
      <div className="container">
        <div ref={revealRef} className="reveal grid md:grid-cols-2 gap-8 sm:gap-12">
          <div>
            <span className="text-xs uppercase tracking-wider text-ink-light mb-2 block">Contáctanos</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-ink-dark mb-5 sm:mb-6">
              Agenda Tu Cita
            </h2>
            <address className="text-ink-light mb-6 not-italic">
              <p>Servicio a domicilio<br />Puerto Rico</p>
            </address>
            <div className="mb-6">
              <p className="text-ink">
                <strong>Lun – Sáb</strong> &nbsp; 9:00 AM – 6:00 PM
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="tel:+17866729528"
                className="px-4 sm:px-6 py-3 border border-border-md rounded-md text-xs sm:text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
              >
                Llamar +1 (786) 672-9528
              </a>
              <a
                href="mailto:Aikopr222@gmail.com"
                className="px-4 sm:px-6 py-3 border border-border-md rounded-md text-xs sm:text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
              >
                Enviar Email
              </a>
            </div>
          </div>
          <div>
            <img
              src={contactCtaImage}
              alt="Espacio de consulta estética con acabados en mármol e iluminación cálida"
              className="w-full rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
