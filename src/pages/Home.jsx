import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Services from '../components/Services'
import Experience from '../components/Experience'
import Testimonials from '../components/Testimonials'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import BookingModal from '../components/BookingModal'
import SubscriptionPromptModal from '../components/SubscriptionPromptModal'
import { useAuth } from '../context/AuthContext'

const SUBSCRIPTION_PROMPT_STORAGE_KEY = 'aiko-subscription-prompt-seen-v1'
const OPEN_BOOKING_MODAL_EVENT = 'aiko:open-booking-modal'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false)
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || user) return

    const alreadySeen = window.localStorage.getItem(SUBSCRIPTION_PROMPT_STORAGE_KEY)
    if (alreadySeen === '1') return

    const timer = window.setTimeout(() => {
      setShowSubscriptionPrompt(true)
    }, 800)

    return () => window.clearTimeout(timer)
  }, [loading, user])

  const handleOpenModal = (serviceId = null, promotion = null) => {
    setSelectedServiceId(serviceId)
    setSelectedPromotion(promotion)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedServiceId(null)
    setSelectedPromotion(null)
  }

  const handleCloseSubscriptionPrompt = () => {
    window.localStorage.setItem(SUBSCRIPTION_PROMPT_STORAGE_KEY, '1')
    setShowSubscriptionPrompt(false)
  }

  useEffect(() => {
    const onOpenBookingFromChat = (event) => {
      const detail = event?.detail || {}
      setSelectedServiceId(detail.serviceId ?? null)
      setSelectedPromotion(detail.promotion ?? null)
      setIsModalOpen(true)
    }

    window.addEventListener(OPEN_BOOKING_MODAL_EVENT, onOpenBookingFromChat)
    return () => window.removeEventListener(OPEN_BOOKING_MODAL_EVENT, onOpenBookingFromChat)
  }, [])

  return (
    <>
      <Header onOpenModal={() => handleOpenModal()} />
      <Hero onOpenModal={handleOpenModal} />
      <Services onOpenModal={handleOpenModal} />
      <Experience />
      <Testimonials />
      <Contact />
      <Footer />
      {isModalOpen && (
        <BookingModal
          onClose={handleCloseModal}
          serviceId={selectedServiceId}
          promotion={selectedPromotion}
        />
      )}
      <SubscriptionPromptModal
        isOpen={showSubscriptionPrompt}
        onClose={handleCloseSubscriptionPrompt}
      />
    </>
  )
}
