import { expect, test } from 'vitest'
import { appointmentToCalendarItem, appointmentsToCalendarItems } from './appointmentCalendar'
import { APPOINTMENT_STATUS, type AppointmentRecord } from './appointmentTypes'

const accepted: AppointmentRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Appointment near midnight UTC',
  status: APPOINTMENT_STATUS.accepted, statusLabel: 'Accepted', meetingFormat: 1,
  meetingFormatLabel: 'Microsoft Teams', preferredDateTime: '2026-10-01T01:30:00Z',
  suggestedDateTime: '2026-10-02T15:00:00Z', agenda: 'Discuss outreach',
  meetingLink: 'https://meet.example.org/accepted', reschedulingReason: '',
  requester: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Requester' },
  recipient: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Recipient' }, rowVersion: '123',
}

test('maps the accepted preferred instant to its Eastern day and namespaces its ID', () => {
  expect(appointmentToCalendarItem(accepted)).toMatchObject({
    id: `appointment:${accepted.id}`, title: accepted.title, date: '2026-09-30',
    startDateTime: '2026-10-01T01:30:00Z', time: '9:30 PM EDT', kind: 'meeting',
    status: 'Accepted', location: 'Online meeting', joinUrl: accepted.meetingLink,
  })
})

test.each([APPOINTMENT_STATUS.pending, APPOINTMENT_STATUS.rescheduled, APPOINTMENT_STATUS.rejected, APPOINTMENT_STATUS.cancelled])('excludes unconfirmed or inactive status %s even when a suggested time exists', (status) => {
  expect(appointmentToCalendarItem({ ...accepted, status })).toBeNull()
})

test('handles winter Eastern time and invalid dates without affecting other calendar items', () => {
  expect(appointmentToCalendarItem({ ...accepted, preferredDateTime: '2026-11-01T06:30:00Z' })).toMatchObject({ date: '2026-11-01', time: '1:30 AM EST' })
  expect(appointmentToCalendarItem({ ...accepted, preferredDateTime: '2026-02-30T10:00:00Z' })).toBeNull()
})

test.each([2, 3])('does not expose an online join action for format %s', (meetingFormat) => {
  expect(appointmentToCalendarItem({ ...accepted, meetingFormat })).toMatchObject({ joinUrl: null })
})

test.each(['javascript:alert(1)', 'http://example.org/insecure', 'not a URL'])('does not expose unsafe online link %s', (meetingLink) => {
  expect(appointmentToCalendarItem({ ...accepted, meetingLink })).toMatchObject({ joinUrl: null })
})

test('deduplicates appointment IDs while preserving the separate calendar ID namespace', () => {
  expect(appointmentsToCalendarItems([accepted, accepted])).toHaveLength(1)
  expect(appointmentsToCalendarItems([accepted])[0].id).not.toBe(accepted.id)
})
