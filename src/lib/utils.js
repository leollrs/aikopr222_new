import { clsx } from 'clsx'

export function cn(...inputs) {
  return clsx(inputs)
}

const dateTimeFormatterEs = new Intl.DateTimeFormat('es-PR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const timeFormatterEs = new Intl.DateTimeFormat('es-PR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatAestheticDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateTimeFormatterEs.format(date)
}

export function formatAestheticTime(value) {
  const [hoursRaw, minutesRaw = '00'] = String(value || '').split(':')
  const hours = Number.parseInt(hoursRaw, 10)
  const minutes = Number.parseInt(minutesRaw, 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(value || '')
  const date = new Date(2000, 0, 1, hours, minutes, 0)
  return timeFormatterEs.format(date)
}
