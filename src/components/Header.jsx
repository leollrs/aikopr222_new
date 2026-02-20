import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'

export default function Header({ onOpenModal }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, userRole, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('No se pudo cerrar sesión correctamente')
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-[76px] z-[900] transition-all duration-300 border-b ${
        scrolled
          ? 'bg-[rgba(20,20,20,0.35)] backdrop-blur-[10px] border-white/8'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-full relative">
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <span className="w-[38px] h-[38px] flex items-center justify-center rounded-full border-[1.5px] border-white/35 font-serif text-lg text-white transition-colors">
            A
          </span>
          <span className="flex flex-col">
            <span className="font-serif text-xl text-white leading-tight">AIKOPR222</span>
            <span className="text-[10px] uppercase tracking-wider text-white/55 leading-none">
              Estética Premium • Servicio Móvil
            </span>
          </span>
        </Link>

        <nav
          className={`absolute left-1/2 -translate-x-1/2 ${
            mobileMenuOpen ? 'block' : 'hidden'
          } md:block`}
        >
          <ul className="flex gap-8">
            <li>
              <a href="#home" className="text-[13px] text-white/75 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-white after:transition-all hover:after:w-full">
                Inicio
              </a>
            </li>
            <li>
              <a href="#services" className="text-[13px] text-white/75 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-white after:transition-all hover:after:w-full">
                Servicios
              </a>
            </li>
            <li>
              <a href="#experience" className="text-[13px] text-white/75 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-white after:transition-all hover:after:w-full">
                Experiencia
              </a>
            </li>
            <li>
              <a href="#testimonials" className="text-[13px] text-white/75 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-white after:transition-all hover:after:w-full">
                Reseñas
              </a>
            </li>
            <li>
              <a href="#contact" className="text-[13px] text-white/75 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-white after:transition-all hover:after:w-full">
                Contacto
              </a>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {userRole === 'admin' ? (
                <Link
                  to="/admin/dashboard"
                  className="text-[13px] text-white/75 hover:text-white transition-colors"
                >
                  Admin
                </Link>
              ) : (
                <Link
                  to="/client/dashboard"
                  className="text-[13px] text-white/75 hover:text-white transition-colors"
                >
                  Mi Cuenta
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-[13px] text-white/75 hover:text-white transition-colors"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-[13px] text-white/75 hover:text-white transition-colors"
            >
              Iniciar Sesión
            </Link>
          )}
          <button
            onClick={onOpenModal}
            className="btnPrimary px-6 py-2.5 rounded-full text-xs uppercase tracking-wider font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            Agendar Cita
          </button>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Abrir menú"
          aria-expanded={mobileMenuOpen}
        >
          <span className={`w-6 h-0.5 bg-white transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`w-6 h-0.5 bg-white transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`w-6 h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
      </div>
    </header>
  )
}
