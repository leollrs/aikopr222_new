export default function Footer() {
  return (
    <footer className="bg-ink-dark text-white py-10 sm:py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-center md:text-left">
          <p className="font-serif text-xl">
            AIKOPR222
            <br />
            <span className="font-sans text-sm text-white/70">Estética avanzada a domicilio</span>
          </p>
          <p className="text-white/60 text-sm">
            &copy; 2026 AIKOPR222. Todos los derechos reservados.
            <br />
            Servicios estéticos no médicos. Resultados pueden variar según la persona.
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/aikopr222/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hover:text-gold transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://api.whatsapp.com/send/?phone=17866729528&text&type=phone_number&app_absent=0"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="hover:text-gold transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2C6.57 2 2.14 6.42 2.14 11.88c0 1.75.46 3.47 1.33 4.98L2 22l5.32-1.39a9.9 9.9 0 004.72 1.2h.01c5.47 0 9.9-4.42 9.9-9.88A9.89 9.89 0 0012.04 2zm5.75 13.98c-.24.68-1.39 1.3-1.92 1.39-.5.08-1.13.12-1.82-.1-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.97-4.39-.15-.2-1.19-1.58-1.19-3.01 0-1.43.75-2.13 1.02-2.42.27-.29.59-.36.79-.36.2 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.81 1.99.88 2.14.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.17-.31.38-.44.5-.15.15-.31.31-.13.62.18.3.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.12.66-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.7-.17 1.38z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
