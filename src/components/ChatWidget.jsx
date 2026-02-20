import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/chatWidget.css'

const OPEN_STATE_KEY = 'aiko-chat-open-v1'
const CLIENT_ID_KEY = 'aikopr222_clientId'
const SESSION_ID_KEY = 'aikopr222_sessionId'
const OPEN_BOOKING_MODAL_EVENT = 'aiko:open-booking-modal'
const DEFAULT_CHAT_WEBHOOK_URL = 'https://leollrs.app.n8n.cloud/webhook/aikopr222/chat'

const QUICK_REPLIES = {
  es: ['Servicios', 'Precios', 'Horario', 'Agendar', 'Ubicación'],
  en: ['Services', 'Pricing', 'Schedule', 'Book', 'Location'],
}

const QUICK_REPLY_PROMPTS = {
  es: {
    Servicios: '¿Qué servicios ofrecen actualmente?',
    Precios: '¿Cuáles son los rangos de precio de sus servicios?',
    Horario: '¿Cuál es su horario y disponibilidad para citas?',
    Agendar: 'Quiero agendar una cita, ¿cómo procedo?',
    Ubicación: '¿En qué zona atienden y cómo funciona el servicio?',
  },
  en: {
    Services: 'What services do you currently offer?',
    Pricing: 'What are your current service price ranges?',
    Schedule: 'What are your hours and current appointment availability?',
    Book: 'I want to book an appointment, how do I proceed?',
    Location: 'Where are you located and how does your service area work?',
  },
}

const WELCOME_COPY = {
  es: '¡Hola! Soy AIKO Asistente. Puedes preguntar por precios, depósito o disponibilidad.',
  en: "Hi! I'm AIKO Assistant. You can ask about pricing, deposit, or availability.",
}

const makeId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`

const getWelcomeMessage = (lang) => ({
  id: makeId(),
  role: 'assistant',
  content: WELCOME_COPY[lang] || WELCOME_COPY.es,
})

const safeStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    window.localStorage.setItem('__ls_test__', '1')
    window.localStorage.removeItem('__ls_test__')
    return window.localStorage
  } catch {
    try {
      window.sessionStorage.setItem('__ss_test__', '1')
      window.sessionStorage.removeItem('__ss_test__')
      return window.sessionStorage
    } catch {
      return null
    }
  }
}

const getOrCreateId = (key, prefix) => {
  const store = safeStorage()
  if (!store) return null

  let value = store.getItem(key)
  if (!value) {
    value = `${prefix}${makeId()}`
    store.setItem(key, value)
  }
  return value
}

const getClientId = () => getOrCreateId(CLIENT_ID_KEY, 'cid_')
const getSessionId = () => getOrCreateId(SESSION_ID_KEY, 'sess_')

const resetChatSession = () => {
  const store = safeStorage()
  store?.removeItem(SESSION_ID_KEY)
}

const extractWebhookMessage = (payload) => {
  if (!payload) return null
  if (typeof payload === 'string') return payload.trim() || null

  const direct =
    payload.message ||
    payload.reply ||
    payload.response ||
    payload.text ||
    payload.output ||
    payload.answer
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const nested =
    payload?.data?.message ||
    payload?.data?.reply ||
    payload?.result?.message ||
    payload?.result?.reply
  if (typeof nested === 'string' && nested.trim()) return nested.trim()

  if (Array.isArray(payload) && payload.length > 0) {
    return extractWebhookMessage(payload[0])
  }

  return null
}

const resolveLang = (langProp) => {
  if (langProp === 'en' || langProp === 'es') return langProp
  if (typeof document !== 'undefined') {
    const htmlLang = (document.documentElement.lang || '').toLowerCase()
    if (htmlLang.startsWith('en')) return 'en'
    if (htmlLang.startsWith('es')) return 'es'
  }
  return 'es'
}

export default function ChatWidget({ lang: langProp = 'es', initialMessage = '', scrollToBooking }) {
  const navigate = useNavigate()
  const location = useLocation()
  const lang = useMemo(() => resolveLang(langProp), [langProp])
  const isEs = lang === 'es'
  const [isOpen, setIsOpen] = useState(() => {
    const store = safeStorage()
    if (!store) return false
    return store.getItem(OPEN_STATE_KEY) === '1'
  })
  const [hasUnread, setHasUnread] = useState(false)
  const [messages, setMessages] = useState(() => [getWelcomeMessage(lang)])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const isOpenRef = useRef(isOpen)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastInitialMessageRef = useRef('')

  const quickReplies = QUICK_REPLIES[lang] || QUICK_REPLIES.es

  useEffect(() => {
    isOpenRef.current = isOpen
    const store = safeStorage()
    store?.setItem(OPEN_STATE_KEY, isOpen ? '1' : '0')
    if (isOpen) setHasUnread(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    setMessages((prev) => {
      if (!prev?.length) return [getWelcomeMessage(lang)]
      const first = prev[0]
      const isWelcome = first?.content === WELCOME_COPY.es || first?.content === WELCOME_COPY.en
      if (first?.role === 'assistant' && isWelcome) {
        const updated = [...prev]
        updated[0] = { ...first, content: WELCOME_COPY[lang] || WELCOME_COPY.es }
        return updated
      }
      return prev
    })
  }, [lang])

  useEffect(() => {
    if (!isOpen) return
    getClientId()
    getSessionId()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      lastInitialMessageRef.current = ''
      return
    }
    setMessages((prev) => (prev?.length ? prev : [getWelcomeMessage(lang)]))
  }, [isOpen, lang])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const addAssistantMessage = (content) => {
    setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', content }])
    if (!isOpenRef.current) {
      setHasUnread(true)
    }
  }

  const sendToApi = async (nextMessages) => {
    setIsSending(true)
    try {
      const webhookUrl = import.meta.env.VITE_CHAT_WEBHOOK_URL || DEFAULT_CHAT_WEBHOOK_URL
      const clientId = getClientId() || 'cid_fallback'
      const sessionId = getSessionId() || 'sess_fallback'
      const requestMessages = nextMessages.map(({ role, content }) => ({ role, content }))
      const latestUserMessage =
        [...requestMessages].reverse().find((message) => message.role === 'user')?.content || ''

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sessionId,
          lang,
          messages: requestMessages,
          latest_message: latestUserMessage,
          selected_service: '',
          assistant_name: 'AIKO Asistente',
        }),
      })

      if (!webhookResponse.ok) {
        addAssistantMessage(
          isEs
            ? `⚠️ Error ${webhookResponse.status} del servidor.`
            : `⚠️ Server error ${webhookResponse.status}.`
        )
        return
      }

      const contentType = webhookResponse.headers.get('content-type') || ''
      let webhookText = null

      if (contentType.includes('application/json')) {
        const data = await webhookResponse.json()
        webhookText = extractWebhookMessage(data)
      } else {
        const text = await webhookResponse.text()
        webhookText = extractWebhookMessage(text)
      }

      if (!webhookText) throw new Error('chat-empty-response')
      addAssistantMessage(webhookText)
    } catch (error) {
      addAssistantMessage(
        isEs
          ? '⚠️ Error al conectar con el asistente. Intenta de nuevo.'
          : '⚠️ Error connecting to assistant. Please try again.'
      )
    } finally {
      setIsSending(false)
    }
  }

  const submitMessage = async (rawMessage) => {
    const trimmed = rawMessage.trim().slice(0, 700)
    if (!trimmed || isSending) return

    const userMessage = { id: makeId(), role: 'user', content: trimmed }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    await sendToApi(nextMessages)
  }

  const onQuickAction = async (action) => {
    const prompt = QUICK_REPLY_PROMPTS[lang]?.[action] || action
    await submitMessage(prompt)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    await submitMessage(input)
  }

  const openBookingModal = (detail = {}) => {
    window.dispatchEvent(new CustomEvent(OPEN_BOOKING_MODAL_EVENT, { detail }))
  }

  const handoffToBooking = () => {
    if (typeof scrollToBooking === 'function') {
      scrollToBooking()
      setIsOpen(false)
      return
    }

    if (location.pathname !== '/') {
      navigate('/')
      window.setTimeout(() => {
        openBookingModal()
      }, 180)
      setIsOpen(false)
      return
    }

    openBookingModal()
    setIsOpen(false)
  }

  const handleNewChat = () => {
    resetChatSession()
    getSessionId()
    setMessages([getWelcomeMessage(lang)])
    setHasUnread(false)
    lastInitialMessageRef.current = ''
  }

  useEffect(() => {
    if (!isOpen || !initialMessage) return
    if (initialMessage === lastInitialMessageRef.current) return
    lastInitialMessageRef.current = initialMessage

    const timer = window.setTimeout(() => {
      submitMessage(initialMessage)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [isOpen, initialMessage])

  return (
    <div className="chatWidgetRoot">
      {isOpen && (
        <section className="chatPanel" aria-label="AIKO Asistente">
          <header className="chatHeader">
            <div>
              <p className="chatHeaderEyebrow">AIKOPR222</p>
              <h3 className="chatHeaderTitle">AIKO Asistente</h3>
            </div>
            <div className="chatHeaderActions">
              <button
                type="button"
                className="chatResetButton"
                onClick={handleNewChat}
                aria-label={isEs ? 'Nuevo chat' : 'New chat'}
              >
                {isEs ? 'Nuevo' : 'New'}
              </button>
              <button
                type="button"
                className="chatCloseButton"
                onClick={() => setIsOpen(false)}
                aria-label={isEs ? 'Cerrar chat' : 'Close chat'}
              >
                &times;
              </button>
            </div>
          </header>

          {messages.length === 1 && (
            <div className="chatQuickActions">
              {quickReplies.map((action) => (
                <button
                  type="button"
                  key={action}
                  className="chatQuickAction"
                  onClick={() => onQuickAction(action)}
                  disabled={isSending}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          <div className="chatMessages" role="log" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chatMessage ${message.role === 'assistant' ? 'chatMessageBot' : 'chatMessageUser'}`}
              >
                {message.content}
              </div>
            ))}
            {isSending && (
              <div className="chatMessage chatMessageBot chatTyping">
                {isEs ? 'Escribiendo...' : 'Typing...'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatBookingRow">
            <button type="button" className="btnPrimary chatBookingButton" onClick={handoffToBooking}>
              Agendar Cita
            </button>
          </div>

          <form className="chatComposer" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isEs ? 'Escribe tu mensaje...' : 'Type your message...'}
              className="chatInput"
              maxLength={700}
              disabled={isSending}
            />
            <button type="submit" className="chatSendButton" disabled={isSending || !input.trim()}>
              {isEs ? 'Enviar' : 'Send'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatBubble"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <span className="chatBubbleIcon" aria-hidden="true">
          {isOpen ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
            </svg>
          )}
        </span>
        {!isOpen && hasUnread && <span className="chatUnreadDot" aria-label="Mensajes sin leer" />}
      </button>
    </div>
  )
}
