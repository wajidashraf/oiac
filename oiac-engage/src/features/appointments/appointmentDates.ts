import type { AppointmentRequestDraft, AppointmentRescheduleDraft } from './appointmentTypes'

const timeZone = 'America/New_York'
const partsFormatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

function easternParts(date: Date): Record<string, string> {
  return Object.fromEntries(partsFormatter.formatToParts(date).map(part => [part.type, part.value]))
}

function localTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || Number(date.slice(0, 4)) < 1753) return null
  const parsed = new Date(`${date}T${time}:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== `${date}T${time}`) return null
  return parsed.getTime()
}

function utcInstant(utc: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?Z$/.test(utc) || Number(utc.slice(0, 4)) < 1753) return null
  const parsed = new Date(utc)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== utc.slice(0, 19)) return null
  return parsed
}

export function getEasternTimeOptions(date: string, time: string): readonly { dateTime: string; offsetMinutes: number; label: string }[] {
  const wallTime = localTimestamp(date, time)
  if (wallTime === null) return []
  const offsets = new Set<number>()
  // Discover nearby timezone offsets through Intl, independently of browser timezone.
  // The bounded window includes both sides of an Eastern DST transition.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wallTime + hours * 3_600_000
    const p = easternParts(new Date(sample))
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    offsets.add((asUtc - sample) / 60_000)
  }
  return [...offsets].flatMap(offsetMinutes => {
    const instant = new Date(wallTime - offsetMinutes * 60_000)
    const p = easternParts(instant)
    if (`${p.year}-${p.month}-${p.day}` !== date || `${p.hour}:${p.minute}` !== time || instant.getUTCFullYear() > 9999) return []
    const sign = offsetMinutes < 0 ? '-' : '+'
    const absolute = Math.abs(offsetMinutes)
    const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
    return [{ dateTime: instant.toISOString(), offsetMinutes, label: `${timeFormatter.format(instant)} (UTC${offset})` }]
  }).sort((a, b) => a.dateTime.localeCompare(b.dateTime))
}

export function formatAppointmentDateTime(utc: string): string {
  const instant = utcInstant(utc)
  return instant ? dateTimeFormatter.format(instant) : '—'
}

export function appointmentCalendarDate(utc: string): string | null {
  const instant = utcInstant(utc)
  if (!instant) return null
  const p = easternParts(instant)
  return `${p.year}-${p.month}-${p.day}`
}

export function appointmentTimeLabel(utc: string): string {
  const instant = utcInstant(utc)
  return instant ? timeFormatter.format(instant) : '—'
}

export function emptyAppointmentRequest(): AppointmentRequestDraft {
  return { title: '', contact: null, meetingFormat: null, preferredDate: '', preferredTime: '', preferredOffsetMinutes: null, agenda: '' }
}

export function emptyAppointmentReschedule(): AppointmentRescheduleDraft {
  return { reason: '', suggestedDate: '', suggestedTime: '', suggestedOffsetMinutes: null }
}
