import { eventCalendarDate, eventLocationLabel } from './eventsData'
import type { EventItem } from '../features/events/eventTypes'

export type CalendarItem = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: 'meeting' | 'event'
  status: 'Accepted' | 'Registered'
  time: string
  location: string
  joinUrl: string | null
}

export type MonthCell = { day: number; isoDate: string } | null

export const acceptedMeetingItems: readonly CalendarItem[] = [
  {
    id: 'meeting-002',
    date: '2026-09-18',
    title: 'Congressional Outreach Training Session',
    kind: 'meeting',
    status: 'Accepted',
    time: '2:00 PM ET',
    location: 'Microsoft Teams',
    joinUrl: 'https://teams.microsoft.com/',
  },
]

export const calendarItems = acceptedMeetingItems

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function eventTimeLabel(startIso: string, endIso: string | null): string {
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : null
  const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
  const startLabel = formatter.format(start)
  if (!end || Number.isNaN(end.getTime())) return startLabel
  return `${startLabel}–${formatter.format(end)}`
}

export function eventToCalendarItem(event: EventItem): CalendarItem | null {
  const date = eventCalendarDate(event.startDateTime)
  if (!date || !event.startDateTime) return null
  return {
    id: event.id,
    date,
    title: event.title,
    kind: 'event',
    status: 'Registered',
    time: eventTimeLabel(event.startDateTime, event.endDateTime),
    location: eventLocationLabel(event.eventFormat, event.venueName, event.meetingUrl),
    joinUrl: safeHttpUrl(event.meetingUrl),
  }
}

export function buildMonthCells(year: number, monthIndex: number): MonthCell[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: MonthCell[] = Array.from({ length: firstWeekday }, () => null)
  const month = String(monthIndex + 1).padStart(2, '0')

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      isoDate: `${year}-${month}-${String(day).padStart(2, '0')}`,
    })
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function itemsForMonth(
  items: readonly CalendarItem[],
  year: number,
  monthIndex: number,
): CalendarItem[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
  return items
    .filter((item) => item.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1))
}
