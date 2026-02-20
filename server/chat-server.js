import express from 'express'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const app = express()
const port = Number(process.env.API_PORT || 8787)
const intakeWebhookUrl =
  process.env.INTAKE_WEBHOOK_URL || 'https://leollrs.app.n8n.cloud/webhook/intake'
const chatWebhookUrl =
  process.env.CHAT_WEBHOOK_URL || 'https://leollrs.app.n8n.cloud/webhook/aikopr222/chat'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const businessHours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const googleCalendarId = process.env.GOOGLE_CALENDAR_ID || ''
const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
const googleServiceAccountPrivateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(
  /\\n/g,
  '\n'
)
const googleCalendarUtcOffset = process.env.GOOGLE_CALENDAR_UTC_OFFSET || '-04:00'
const googleCalendarTimeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Puerto_Rico'

const googleOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const googleOAuthRedirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://localhost:${port}/api/google-calendar/oauth/callback`
const googleOAuthAppUrl = (process.env.GOOGLE_OAUTH_APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
const oauthTokenStorePath = path.resolve(process.cwd(), 'server', '.google-calendar-oauth.json')
const oauthStateStore = new Map()

const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

const sanitizeAdminReturnTo = (value) => {
  const raw = String(value || '').trim()
  if (!raw.startsWith('/')) return '/admin/dashboard'
  if (!raw.startsWith('/admin')) return '/admin/dashboard'
  if (raw.length > 250) return '/admin/dashboard'
  return raw
}

const buildAppRedirect = (returnTo, status) => {
  const safeReturnTo = sanitizeAdminReturnTo(returnTo)
  const separator = safeReturnTo.includes('?') ? '&' : '?'
  return `${googleOAuthAppUrl}${safeReturnTo}${separator}googleCalendar=${encodeURIComponent(status)}`
}

const toIsoWithOffset = (date, time) => `${date}T${time}:00${googleCalendarUtcOffset}`

const clampDurationMinutes = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (Number.isNaN(parsed) || parsed <= 0) return 60
  return Math.min(parsed, 8 * 60)
}

const isSlotBusy = (slotStart, busyRanges, durationMinutes = 60) => {
  const slotStartDate = new Date(slotStart)
  const slotEndDate = new Date(slotStartDate.getTime() + clampDurationMinutes(durationMinutes) * 60 * 1000)

  return busyRanges.some((range) => {
    const busyStart = new Date(range.start)
    const busyEnd = new Date(range.end)
    return slotStartDate < busyEnd && slotEndDate > busyStart
  })
}

const readOAuthTokenStore = async () => {
  try {
    const raw = await fs.readFile(oauthTokenStorePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed reading OAuth token store:', error)
    }
    return null
  }
}

const writeOAuthTokenStore = async (payload) => {
  await fs.writeFile(oauthTokenStorePath, JSON.stringify(payload, null, 2), 'utf-8')
}

const clearOAuthTokenStore = async () => {
  try {
    await fs.unlink(oauthTokenStorePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed clearing OAuth token store:', error)
    }
  }
}

const persistRefreshedOAuthTokens = async (stored, refreshedTokens) => {
  if (!stored?.tokens) return
  if (!refreshedTokens?.access_token && !refreshedTokens?.refresh_token) return

  const mergedTokens = {
    ...stored.tokens,
    ...refreshedTokens,
  }
  if (!mergedTokens.refresh_token && stored.tokens.refresh_token) {
    mergedTokens.refresh_token = stored.tokens.refresh_token
  }

  await writeOAuthTokenStore({
    ...stored,
    tokens: mergedTokens,
    updatedAt: new Date().toISOString(),
  })
}

const getGoogleOAuthClient = () => {
  if (!googleOAuthClientId || !googleOAuthClientSecret || !googleOAuthRedirectUri) return null
  return new google.auth.OAuth2({
    clientId: googleOAuthClientId,
    clientSecret: googleOAuthClientSecret,
    redirectUri: googleOAuthRedirectUri,
  })
}

const buildAvailabilityFromBusyRanges = ({
  date,
  busyRanges,
  source,
  configured,
  message,
  calendarId,
  durationMinutes = 60,
}) => {
  const normalizedDuration = clampDurationMinutes(durationMinutes)
  const now = new Date()
  const busySlots = []
  const availableSlots = businessHours.filter((slot) => {
    const slotStart = toIsoWithOffset(date, slot)
    const slotStartDate = new Date(slotStart)
    const alreadyPassed = slotStartDate <= now
    if (alreadyPassed) {
      busySlots.push(slot)
      return false
    }

    const busy = isSlotBusy(slotStart, busyRanges, normalizedDuration)
    if (busy) busySlots.push(slot)
    return !busy
  })

  return {
    availableSlots,
    busySlots,
    configured,
    source,
    message,
    calendarId,
    durationMinutes: normalizedDuration,
  }
}

const tokenHasCalendarWriteScope = (scopeValue) => {
  const scope = String(scopeValue || '')
  if (!scope) return false
  return (
    scope.includes('https://www.googleapis.com/auth/calendar.events') ||
    scope.includes('https://www.googleapis.com/auth/calendar')
  )
}

const getAvailabilityFromOAuthCalendar = async (date, durationMinutes = 60) => {
  const oauthClient = getGoogleOAuthClient()
  if (!oauthClient) return null

  const stored = await readOAuthTokenStore()
  if (!stored?.tokens) return null

  oauthClient.setCredentials(stored.tokens)

  let refreshedTokens = null
  oauthClient.on('tokens', (tokens) => {
    refreshedTokens = tokens
  })

  const calendarId = stored.calendarId || 'primary'

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauthClient })
    const dayStart = toIsoWithOffset(date, '00:00')
    const dayEnd = toIsoWithOffset(date, '23:59')

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart,
        timeMax: dayEnd,
        items: [{ id: calendarId }],
      },
    })

    await persistRefreshedOAuthTokens(stored, refreshedTokens)

    const busyRanges = freeBusy?.data?.calendars?.[calendarId]?.busy || []

    return {
      ...buildAvailabilityFromBusyRanges({
        date,
        busyRanges,
        source: 'google-oauth',
        configured: true,
        calendarId,
        durationMinutes,
      }),
      connectedEmail: stored.connectedEmail || '',
    }
  } catch (error) {
    console.error('OAuth calendar availability failed:', error)
    return null
  }
}

const getAvailabilityFromServiceAccountCalendar = async (date, durationMinutes = 60) => {
  if (!googleCalendarId || !googleServiceAccountEmail || !googleServiceAccountPrivateKey) {
    return null
  }

  try {
    const auth = new google.auth.JWT({
      email: googleServiceAccountEmail,
      key: googleServiceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    const calendar = google.calendar({ version: 'v3', auth })

    const dayStart = toIsoWithOffset(date, '00:00')
    const dayEnd = toIsoWithOffset(date, '23:59')
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart,
        timeMax: dayEnd,
        items: [{ id: googleCalendarId }],
      },
    })

    const busyRanges = freeBusy?.data?.calendars?.[googleCalendarId]?.busy || []
    return buildAvailabilityFromBusyRanges({
      date,
      busyRanges,
      source: 'google-service-account',
      configured: true,
      calendarId: googleCalendarId,
      durationMinutes,
    })
  } catch (error) {
    console.error('Service account calendar availability failed:', error)
    return null
  }
}

const getCalendarAvailability = async (date, durationMinutes = 60) => {
  const oauthAvailability = await getAvailabilityFromOAuthCalendar(date, durationMinutes)
  if (oauthAvailability) return oauthAvailability

  const serviceAccountAvailability = await getAvailabilityFromServiceAccountCalendar(
    date,
    durationMinutes
  )
  if (serviceAccountAvailability) return serviceAccountAvailability

  return {
    availableSlots: businessHours,
    busySlots: [],
    configured: false,
    source: 'fallback',
    message: 'Google Calendar no está configurado en el servidor.',
    calendarId: null,
    durationMinutes: clampDurationMinutes(durationMinutes),
  }
}

const createCalendarEventRequest = ({
  date,
  time,
  durationMinutes,
  serviceNames,
  fullName,
  email,
  phone,
  contactMethod,
  location,
  address,
  mainGoal,
  additionalNotes,
  appointmentId,
}) => {
  const normalizedDuration = clampDurationMinutes(durationMinutes)
  const serviceList = Array.isArray(serviceNames)
    ? serviceNames.map((name) => String(name || '').trim()).filter(Boolean)
    : []
  const summaryService = serviceList.length ? serviceList.join(' + ') : 'Cita estética'

  const startDateTime = new Date(toIsoWithOffset(date, time))
  if (Number.isNaN(startDateTime.getTime())) {
    throw new Error('invalid-datetime')
  }
  const endDateTime = new Date(startDateTime.getTime() + normalizedDuration * 60 * 1000)

  const lines = [
    `Cliente: ${String(fullName || '').trim() || 'No indicado'}`,
    `Email: ${String(email || '').trim() || 'No indicado'}`,
    `Teléfono: ${String(phone || '').trim() || 'No indicado'}`,
    `Método de contacto: ${String(contactMethod || '').trim() || 'No indicado'}`,
    `Servicios: ${summaryService}`,
    `Duración estimada: ${normalizedDuration} min`,
    `Ubicación: ${location === 'domicilio' ? 'A domicilio' : 'En local'}`,
  ]

  if (location === 'domicilio' && String(address || '').trim()) {
    lines.push(`Dirección: ${String(address || '').trim()}`)
  }
  if (String(mainGoal || '').trim()) {
    lines.push(`Objetivo: ${String(mainGoal || '').trim()}`)
  }
  if (String(additionalNotes || '').trim()) {
    lines.push(`Notas: ${String(additionalNotes || '').trim()}`)
  }
  if (appointmentId) {
    lines.push(`Appointment ID: ${appointmentId}`)
  }

  return {
    requestBody: {
      summary: `AIKOPR222 | ${summaryService}`,
      description: lines.join('\n'),
      location:
        location === 'domicilio'
          ? String(address || '').trim() || 'Servicio a domicilio'
          : 'AIKOPR222 - En local',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: googleCalendarTimeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: googleCalendarTimeZone,
      },
      attendees: String(email || '').trim() ? [{ email: String(email || '').trim() }] : [],
      extendedProperties: {
        private: {
          appointmentId: String(appointmentId || ''),
          source: 'aikopr222-booking',
        },
      },
    },
    durationMinutes: normalizedDuration,
  }
}

const createEventInOAuthCalendar = async (eventInsertPayload) => {
  const oauthClient = getGoogleOAuthClient()
  if (!oauthClient) return null

  const stored = await readOAuthTokenStore()
  if (!stored?.tokens) return null

  oauthClient.setCredentials(stored.tokens)
  let refreshedTokens = null
  oauthClient.on('tokens', (tokens) => {
    refreshedTokens = tokens
  })

  const calendarId = stored.calendarId || 'primary'
  const calendar = google.calendar({ version: 'v3', auth: oauthClient })
  const response = await calendar.events.insert({
    calendarId,
    ...eventInsertPayload,
    sendUpdates: 'none',
  })

  await persistRefreshedOAuthTokens(stored, refreshedTokens)

  return {
    source: 'google-oauth',
    calendarId,
    eventId: response?.data?.id || null,
    htmlLink: response?.data?.htmlLink || null,
  }
}

const createEventInServiceAccountCalendar = async (eventInsertPayload) => {
  if (!googleCalendarId || !googleServiceAccountEmail || !googleServiceAccountPrivateKey) {
    return null
  }

  const auth = new google.auth.JWT({
    email: googleServiceAccountEmail,
    key: googleServiceAccountPrivateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  const calendar = google.calendar({ version: 'v3', auth })
  const response = await calendar.events.insert({
    calendarId: googleCalendarId,
    ...eventInsertPayload,
    sendUpdates: 'none',
  })

  return {
    source: 'google-service-account',
    calendarId: googleCalendarId,
    eventId: response?.data?.id || null,
    htmlLink: response?.data?.htmlLink || null,
  }
}

const findEventIdByAppointmentIdOAuth = async ({ calendar, calendarId, appointmentId }) => {
  if (!appointmentId) return null
  const response = await calendar.events.list({
    calendarId,
    maxResults: 1,
    singleEvents: false,
    privateExtendedProperty: [`appointmentId=${String(appointmentId)}`],
  })
  return response?.data?.items?.[0]?.id || null
}

const findEventIdByAppointmentIdServiceAccount = async ({ calendar, calendarId, appointmentId }) => {
  if (!appointmentId) return null
  const response = await calendar.events.list({
    calendarId,
    maxResults: 1,
    singleEvents: false,
    privateExtendedProperty: [`appointmentId=${String(appointmentId)}`],
  })
  return response?.data?.items?.[0]?.id || null
}

const deleteEventInOAuthCalendar = async ({ eventId, appointmentId }) => {
  const oauthClient = getGoogleOAuthClient()
  if (!oauthClient) return null

  const stored = await readOAuthTokenStore()
  if (!stored?.tokens) return null

  oauthClient.setCredentials(stored.tokens)
  let refreshedTokens = null
  oauthClient.on('tokens', (tokens) => {
    refreshedTokens = tokens
  })

  const calendarId = stored.calendarId || 'primary'
  const calendar = google.calendar({ version: 'v3', auth: oauthClient })
  const resolvedEventId =
    String(eventId || '').trim() ||
    (await findEventIdByAppointmentIdOAuth({ calendar, calendarId, appointmentId }))

  if (!resolvedEventId) {
    return {
      source: 'google-oauth',
      calendarId,
      deleted: false,
      reason: 'not_found',
    }
  }

  try {
    await calendar.events.delete({
      calendarId,
      eventId: resolvedEventId,
      sendUpdates: 'none',
    })
  } catch (error) {
    if (error?.response?.status !== 404) throw error
  }

  await persistRefreshedOAuthTokens(stored, refreshedTokens)

  return {
    source: 'google-oauth',
    calendarId,
    eventId: resolvedEventId,
    deleted: true,
  }
}

const deleteEventInServiceAccountCalendar = async ({ eventId, appointmentId }) => {
  if (!googleCalendarId || !googleServiceAccountEmail || !googleServiceAccountPrivateKey) {
    return null
  }

  const auth = new google.auth.JWT({
    email: googleServiceAccountEmail,
    key: googleServiceAccountPrivateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  const calendar = google.calendar({ version: 'v3', auth })
  const resolvedEventId =
    String(eventId || '').trim() ||
    (await findEventIdByAppointmentIdServiceAccount({
      calendar,
      calendarId: googleCalendarId,
      appointmentId,
    }))

  if (!resolvedEventId) {
    return {
      source: 'google-service-account',
      calendarId: googleCalendarId,
      deleted: false,
      reason: 'not_found',
    }
  }

  try {
    await calendar.events.delete({
      calendarId: googleCalendarId,
      eventId: resolvedEventId,
      sendUpdates: 'none',
    })
  } catch (error) {
    if (error?.response?.status !== 404) throw error
  }

  return {
    source: 'google-service-account',
    calendarId: googleCalendarId,
    eventId: resolvedEventId,
    deleted: true,
  }
}

const parseBearerToken = (authorizationHeader) => {
  const value = String(authorizationHeader || '')
  if (!value.toLowerCase().startsWith('bearer ')) return ''
  return value.slice(7).trim()
}

const normalizeRole = (value) => {
  if (value === 'admin' || value === 'client') return value
  return null
}

const resolveRoleWithUserClient = async (userClient, userId) => {
  try {
    const { data, error } = await userClient.rpc('get_my_role')
    if (!error) {
      const role = normalizeRole(data)
      if (role) return role
    }
  } catch (error) {
    const code = error?.code || error?.status || 'unknown'
    if (!['42883', 'PGRST202'].includes(String(code))) {
      console.warn('Server get_my_role failed:', error)
    }
  }

  try {
    const { data, error } = await userClient
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('Server role query failed:', error)
      return null
    }
    return normalizeRole(data?.role)
  } catch (error) {
    console.warn('Server role fallback failed:', error)
    return null
  }
}

const requireAdmin = async (req, res) => {
  const accessToken = parseBearerToken(req.headers.authorization)
  if (!accessToken) {
    res.status(401).json({ error: 'Missing access token.' })
    return null
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Supabase server auth is not configured.' })
    return null
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken)

  if (userError || !user?.id) {
    res.status(401).json({ error: 'Invalid session token.' })
    return null
  }

  const role = await resolveRoleWithUserClient(userClient, user.id)
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin role required.' })
    return null
  }

  return { user }
}

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

app.post('/api/google-calendar/oauth/start', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const oauthClient = getGoogleOAuthClient()
    if (!oauthClient) {
      return res.status(500).json({
        error: 'Google OAuth is not configured. Missing GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI.',
      })
    }

    const state = crypto.randomUUID()
    const returnTo = sanitizeAdminReturnTo(req.body?.returnTo)
    oauthStateStore.set(state, {
      userId: admin.user.id,
      returnTo,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    setTimeout(() => oauthStateStore.delete(state), 10 * 60 * 1000)

    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    })

    return res.json({ url })
  } catch (error) {
    console.error('Google OAuth start error:', error)
    return res.status(500).json({ error: 'Failed to initialize Google OAuth.' })
  }
})

app.get('/api/google-calendar/oauth/callback', async (req, res) => {
  const fallbackRedirect = buildAppRedirect('/admin/dashboard', 'error')

  try {
    const state = String(req.query?.state || '')
    const code = String(req.query?.code || '')

    if (!state || !code) {
      return res.redirect(fallbackRedirect)
    }

    const statePayload = oauthStateStore.get(state)
    oauthStateStore.delete(state)
    if (!statePayload || statePayload.expiresAt < Date.now()) {
      return res.redirect(fallbackRedirect)
    }

    const oauthClient = getGoogleOAuthClient()
    if (!oauthClient) {
      return res.redirect(fallbackRedirect)
    }

    const { tokens } = await oauthClient.getToken(code)
    oauthClient.setCredentials(tokens)

    let connectedEmail = ''
    try {
      const oauth2 = google.oauth2({ auth: oauthClient, version: 'v2' })
      const userInfo = await oauth2.userinfo.get()
      connectedEmail = userInfo?.data?.email || ''
    } catch (profileError) {
      console.warn('Could not fetch OAuth user profile:', profileError)
    }

    const previous = await readOAuthTokenStore()
    const mergedTokens = {
      ...(previous?.tokens || {}),
      ...tokens,
    }
    if (!mergedTokens.refresh_token && previous?.tokens?.refresh_token) {
      mergedTokens.refresh_token = previous.tokens.refresh_token
    }

    await writeOAuthTokenStore({
      tokens: mergedTokens,
      calendarId: 'primary',
      connectedEmail,
      connectedByUserId: statePayload.userId,
      updatedAt: new Date().toISOString(),
      source: 'google-oauth',
    })

    return res.redirect(buildAppRedirect(statePayload.returnTo, 'connected'))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return res.redirect(fallbackRedirect)
  }
})

app.get('/api/google-calendar/status', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const stored = await readOAuthTokenStore()
    const connected = Boolean(stored?.tokens?.refresh_token || stored?.tokens?.access_token)
    const scope = stored?.tokens?.scope || ''
    const canWriteEvents = tokenHasCalendarWriteScope(scope)

    return res.json({
      connected,
      connectedEmail: stored?.connectedEmail || '',
      updatedAt: stored?.updatedAt || null,
      calendarId: stored?.calendarId || null,
      source: stored?.source || null,
      connectedByUserId: stored?.connectedByUserId || null,
      scope,
      canWriteEvents,
    })
  } catch (error) {
    console.error('Google calendar status error:', error)
    return res.status(500).json({ error: 'Failed to read Google Calendar status.' })
  }
})

app.post('/api/google-calendar/disconnect', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    await clearOAuthTokenStore()
    return res.json({ ok: true })
  } catch (error) {
    console.error('Google calendar disconnect error:', error)
    return res.status(500).json({ error: 'Failed to disconnect Google Calendar.' })
  }
})

app.post('/api/google-calendar/events', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : null
    if (!payload) {
      return res.status(400).json({ error: 'payload is required.' })
    }

    const date = String(payload.date || '').trim()
    const time = String(payload.time || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'date and time are required in YYYY-MM-DD and HH:mm format.' })
    }

    const eventInsertPayload = createCalendarEventRequest({
      date,
      time,
      durationMinutes: payload.durationMinutes,
      serviceNames: payload.serviceNames,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      contactMethod: payload.contactMethod,
      location: payload.location,
      address: payload.address,
      mainGoal: payload.mainGoal,
      additionalNotes: payload.additionalNotes,
      appointmentId: payload.appointmentId,
    })

    const storedOAuth = await readOAuthTokenStore()
    const oauthConnected = Boolean(storedOAuth?.tokens?.refresh_token || storedOAuth?.tokens?.access_token)
    const oauthScope = storedOAuth?.tokens?.scope || ''

    if (oauthConnected && !tokenHasCalendarWriteScope(oauthScope)) {
      return res.status(403).json({
        error:
          'La cuenta de Google está conectada con permisos solo lectura. Re-sincroniza para permitir crear eventos.',
        code: 'GOOGLE_OAUTH_READONLY',
      })
    }

    try {
      const oauthResult = await createEventInOAuthCalendar(eventInsertPayload)
      if (oauthResult) {
        return res.json({ ok: true, ...oauthResult, durationMinutes: eventInsertPayload.durationMinutes })
      }
    } catch (oauthError) {
      const status = oauthError?.response?.status
      const message = oauthError?.response?.data?.error?.message || oauthError?.message || ''
      if (status === 403) {
        return res.status(403).json({
          error:
            'Google OAuth no tiene permisos para crear eventos. Re-sincroniza con permisos de calendario.',
          details: message,
        })
      }
      console.error('OAuth calendar event creation failed:', oauthError)
    }

    // If OAuth is connected but failed to insert, don't silently fallback to another calendar.
    if (oauthConnected) {
      return res.status(502).json({
        error: 'No se pudo crear el evento en el calendario sincronizado por admin.',
      })
    }

    try {
      const serviceResult = await createEventInServiceAccountCalendar(eventInsertPayload)
      if (serviceResult) {
        return res.json({ ok: true, ...serviceResult, durationMinutes: eventInsertPayload.durationMinutes })
      }
    } catch (serviceError) {
      console.error('Service account calendar event creation failed:', serviceError)
    }

    return res.status(503).json({
      error: 'No calendar connection is available to create events.',
    })
  } catch (error) {
    if (error?.message === 'invalid-datetime') {
      return res.status(400).json({ error: 'invalid date/time value.' })
    }
    console.error('Calendar event endpoint error:', error)
    return res.status(500).json({ error: 'Unexpected calendar event error.' })
  }
})

app.post('/api/google-calendar/events/delete', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : null
    if (!payload) {
      return res.status(400).json({ error: 'payload is required.' })
    }

    const eventId = String(payload.eventId || '').trim()
    const appointmentId = String(payload.appointmentId || '').trim()
    const source = String(payload.source || '').trim().toLowerCase()
    if (!eventId && !appointmentId) {
      return res.status(400).json({ error: 'eventId or appointmentId is required.' })
    }

    const storedOAuth = await readOAuthTokenStore()
    const oauthConnected = Boolean(storedOAuth?.tokens?.refresh_token || storedOAuth?.tokens?.access_token)
    const oauthScope = storedOAuth?.tokens?.scope || ''

    const preferredSource =
      source === 'google-oauth' || source === 'google-service-account' ? source : ''
    const shouldTryOAuth = preferredSource ? preferredSource === 'google-oauth' : true
    const shouldTryService = preferredSource ? preferredSource === 'google-service-account' : true

    let oauthResult = null
    let oauthDeleteError = null
    if (shouldTryOAuth) {
      if (oauthConnected && !tokenHasCalendarWriteScope(oauthScope)) {
        oauthDeleteError = new Error('GOOGLE_OAUTH_READONLY')
        oauthDeleteError.code = 'GOOGLE_OAUTH_READONLY'
      } else {
        try {
          oauthResult = await deleteEventInOAuthCalendar({ eventId, appointmentId })
          if (oauthResult?.deleted) {
            return res.json({ ok: true, ...oauthResult })
          }
        } catch (oauthError) {
          oauthDeleteError = oauthError
          console.error('OAuth calendar event delete failed:', oauthError)
        }
      }
    }

    let serviceResult = null
    let serviceDeleteError = null
    try {
      if (shouldTryService) {
        serviceResult = await deleteEventInServiceAccountCalendar({ eventId, appointmentId })
        if (serviceResult?.deleted) {
          return res.json({ ok: true, ...serviceResult })
        }
      }
    } catch (serviceError) {
      serviceDeleteError = serviceError
      console.error('Service account calendar event delete failed:', serviceError)
    }

    if (preferredSource === 'google-oauth' && oauthDeleteError?.code === 'GOOGLE_OAUTH_READONLY') {
      return res.status(403).json({
        error:
          'La cuenta de Google está conectada con permisos solo lectura. Re-sincroniza para permitir eliminar eventos.',
        code: 'GOOGLE_OAUTH_READONLY',
      })
    }

    if (preferredSource === 'google-service-account' && serviceDeleteError) {
      return res.status(502).json({
        error: 'No se pudo eliminar el evento en el calendario de servicio.',
        details: serviceDeleteError?.message || '',
      })
    }

    if (oauthConnected && shouldTryOAuth) {
      const oauthStatus = oauthDeleteError?.response?.status
      const oauthMessage =
        oauthDeleteError?.response?.data?.error?.message || oauthDeleteError?.message || ''

      if (
        !oauthDeleteError &&
        !serviceDeleteError &&
        (oauthResult?.reason === 'not_found' || serviceResult?.reason === 'not_found')
      ) {
        return res.status(404).json({
          error: 'No se encontró el evento en Google Calendar.',
          details: `eventId=${eventId || 'n/a'} appointmentId=${appointmentId || 'n/a'}`,
        })
      }

      if (oauthDeleteError?.code === 'GOOGLE_OAUTH_READONLY' && shouldTryService) {
        if (serviceResult?.deleted) {
          return res.json({ ok: true, ...serviceResult, fallbackAttempted: true })
        }
        if (serviceResult?.reason === 'not_found') {
          return res.status(404).json({
            error:
              'La cuenta de Google está conectada en solo lectura y no se encontró el evento en el calendario alterno.',
            code: 'GOOGLE_OAUTH_READONLY',
          })
        }
      }

      return res.status(502).json({
        error:
          oauthStatus === 403
            ? 'Google rechazó la eliminación del evento. Re-sincroniza la cuenta admin y vuelve a intentar.'
            : 'No se pudo eliminar el evento en el calendario sincronizado por admin.',
        details: oauthMessage,
      })
    }

    if (!oauthConnected && !serviceDeleteError && serviceResult?.reason === 'not_found') {
      return res.status(404).json({
        error: 'No se encontró el evento en Google Calendar.',
        details: `eventId=${eventId || 'n/a'} appointmentId=${appointmentId || 'n/a'}`,
      })
    }

    return res.status(503).json({
      error: 'No calendar connection is available to delete events.',
    })
  } catch (error) {
    console.error('Calendar event delete endpoint error:', error)
    return res.status(500).json({ error: 'Unexpected calendar event delete error.' })
  }
})

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

app.get('/api/availability', async (req, res) => {
  try {
    const date = String(req.query?.date || '').trim()
    const time = String(req.query?.time || '').trim()
    const durationMinutes = clampDurationMinutes(req.query?.durationMinutes)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date is required in YYYY-MM-DD format.' })
    }

    const availability = await getCalendarAvailability(date, durationMinutes)
    if (time) {
      const isAvailable = availability.availableSlots.includes(time)
      return res.json({
        ...availability,
        selectedTime: time,
        isAvailable,
        durationMinutes,
      })
    }

    return res.json(availability)
  } catch (error) {
    console.error('Availability endpoint error:', error)
    return res.status(500).json({ error: 'Unexpected availability error.' })
  }
})

app.listen(port, () => {
  console.log(`Chat API server running on http://localhost:${port}`)
})
