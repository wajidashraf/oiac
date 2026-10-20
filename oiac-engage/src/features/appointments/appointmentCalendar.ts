import type { CalendarItem } from '../../data/calendarData'
import { appointmentCalendarDate, appointmentTimeLabel } from './appointmentDates'
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, type AppointmentRecord } from './appointmentTypes'

function safeMeetingLink(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}

export function appointmentToCalendarItem(record: AppointmentRecord): CalendarItem | null {
  if (record.status !== APPOINTMENT_STATUS.accepted) return null
  const date = appointmentCalendarDate(record.preferredDateTime)
  if (!date) return null
  const online = record.meetingFormat === APPOINTMENT_FORMAT.teams
  return {
    id: `appointment:${record.id}`, title: record.title, date: date as CalendarItem['date'],
    kind: 'meeting', status: 'Accepted', startDateTime: record.preferredDateTime,
    time: appointmentTimeLabel(record.preferredDateTime),
    location: online ? 'Online meeting' : record.meetingFormat === APPOINTMENT_FORMAT.phone ? 'Phone call' : record.meetingFormat === APPOINTMENT_FORMAT.inPerson ? 'In person' : 'Meeting format unavailable',
    joinUrl: online ? safeMeetingLink(record.meetingLink) : null,
  }
}

export function appointmentsToCalendarItems(records: readonly AppointmentRecord[]): readonly CalendarItem[] {
  const unique = new Map<string, CalendarItem>()
  for (const record of records) {
    const item = appointmentToCalendarItem(record)
    if (item) unique.set(item.id, item)
  }
  return [...unique.values()]
}
