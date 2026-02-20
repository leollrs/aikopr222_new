import { useEffect, useRef } from 'react'

const testimonial = {
  quote: 'Me realizo láser y desde la primera sesión he visto cambios. Muy buena atención.',
  author: 'paola carrasco cardenas',
}

export default function Testimonials() {
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
    <section id="testimonials" className="py-16 sm:py-24 bg-bg">
      <div className="container">
        <header className="text-center mb-10 sm:mb-12">
          <span className="text-xs uppercase tracking-wider text-ink-light mb-2 block">Reseñas</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-ink-dark">
            Lo Que Dicen Nuestros Clientes
          </h2>
        </header>

        <div ref={revealRef} className="reveal relative max-w-4xl mx-auto">
          <div className="px-4">
            <article className="text-center">
              <div className="text-2xl text-gold mb-4" aria-label="5 de 5 estrellas">
                ★★★★★
              </div>
              <blockquote className="text-lg sm:text-xl text-ink mb-8 leading-relaxed max-w-2xl mx-auto">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <footer className="flex items-center justify-center gap-4">
                <div
                  className="w-16 h-16 rounded-full bg-bg-alt border border-border flex items-center justify-center text-base font-semibold text-ink-dark uppercase"
                  aria-label={`Photo of ${testimonial.author}`}
                >
                  PC
                </div>
                <div className="text-left">
                  <cite className="font-semibold text-ink-dark block not-italic">{testimonial.author}</cite>
                </div>
              </footer>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
