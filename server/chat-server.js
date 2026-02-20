import express from 'express'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const app = express()
const port = Number(process.env.API_PORT || 8787)
const intakeWebhookUrl =
  process.env.INTAKE_WEBHOOK_URL || 'https://leollrs.app.n8n.cloud/webhook/intake'
const chatWebhookUrl =
  process.env.CHAT_WEBHOOK_URL || 'https://leollrs.app.n8n.cloud/webhook/aikopr222/chat'

app.use(express.json({ limit: '200kb' }))

const WINDOW_MS = 5 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20
const requestTracker = new Map()

const sanitizeMessages = (input) => {
  if (!Array.isArray(input)) return []

  return input
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }))
    .filter((message) => message.content.length > 0)
}

const isRateLimited = (ip) => {
  const now = Date.now()
  const entry = requestTracker.get(ip)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestTracker.set(ip, { windowStart: now, count: 1 })
    return false
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }

  entry.count += 1
  requestTracker.set(ip, entry)
  return false
}

const systemPrompt = `
Eres "AIKO Asistente" para AIKOPR222, una clínica estética premium.
Estilo: calmado, profesional, conciso, lujo discreto.
Idioma: responde en español por defecto. Si el usuario escribe en inglés, responde en inglés.
Objetivo: ayudar con servicios, precios, disponibilidad, ubicación y reservas.
Haz máximo 1-2 preguntas de aclaración antes de sugerir reservar.
Cuando aplique, invita a reservar con mensaje corto y claro.
Si preguntan temas médicos o de seguridad clínica, incluye esta frase:
"Información general, no sustituye evaluación profesional."
No inventes datos concretos no confirmados. Si no sabes, dilo brevemente y redirige a reservar.
`

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

app.post('/api/chat', async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' })
    }

    const messages = sanitizeMessages(req.body?.messages)
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages is required and must include at least one valid message.' })
    }

    const limitedMessages = messages.slice(-16)
    const latestUserMessage =
      [...limitedMessages].reverse().find((msg) => msg.role === 'user')?.content || ''

    const webhookPayload = {
      messages: limitedMessages,
      latest_message: latestUserMessage,
      system_prompt: systemPrompt.trim(),
      assistant_name: 'AIKO Asistente',
    }

    const response = await fetch(chatWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Chat webhook error:', response.status, errorBody)
      return res.status(502).json({ error: 'Chat service is unavailable right now.' })
    }

    const contentType = response.headers.get('content-type') || ''
    let assistantMessage = null

    if (contentType.includes('application/json')) {
      const data = await response.json()
      assistantMessage = extractWebhookMessage(data)
    } else {
      const text = await response.text()
      assistantMessage = extractWebhookMessage(text)
    }

    if (!assistantMessage) {
      return res.status(502).json({ error: 'No response received from chat webhook.' })
    }

    return res.json({ message: assistantMessage })
  } catch (error) {
    console.error('Chat endpoint error:', error)
    return res.status(500).json({ error: 'Unexpected server error.' })
  }
})

app.post('/api/intake', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : null
    if (!payload) {
      return res.status(400).json({ error: 'payload is required.' })
    }

    const response = await fetch(intakeWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Intake webhook error:', response.status, errorBody)
      return res.status(502).json({ error: 'intake webhook failed.' })
    }

    return res.json({ ok: true })
  } catch (error) {
    console.error('Intake relay error:', error)
    return res.status(500).json({ error: 'Unexpected intake relay error.' })
  }
})

app.listen(port, () => {
  console.log(`Chat API server running on http://localhost:${port}`)
})
