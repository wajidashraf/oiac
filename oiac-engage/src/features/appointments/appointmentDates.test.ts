import { describe, expect, test } from 'vitest'
import {
  appointmentCalendarDate, appointmentTimeLabel, emptyAppointmentRequest, emptyAppointmentReschedule,
  formatAppointmentDateTime, getEasternTimeOptions,
} from './appointmentDates'

describe('Eastern appointment dates', () => {
  test('converts winter and summer wall times using their actual Eastern offsets', () => {
    expect(getEasternTimeOptions('2026-01-10', '09:30')).toMatchObject([{ dateTime: '2026-01-10T14:30:00.000Z', offsetMinutes: -300 }])
    expect(getEasternTimeOptions('2026-07-10', '09:30')).toMatchObject([{ dateTime: '2026-07-10T13:30:00.000Z', offsetMinutes: -240 }])
  })
  test('rejects the spring gap and exposes both fall occurrences in instant order', () => {
    expect(getEasternTimeOptions('2026-03-08', '02:30')).toEqual([])
    expect(getEasternTimeOptions('2026-11-01', '01:30')).toMatchObject([
      { dateTime: '2026-11-01T05:30:00.000Z', offsetMinutes: -240 },
      { dateTime: '2026-11-01T06:30:00.000Z', offsetMinutes: -300 },
    ])
    expect(getEasternTimeOptions('2026-11-01', '01:30').map(option => option.label).join(' ')).toMatch(/UTC-04:00.*UTC-05:00/)
  })
  test.each([
    ['2026-02-30', '09:30'], ['2026-13-01', '09:30'], ['2026-1-01', '09:30'], ['1752-12-31', '09:30'],
    ['2026-01-01', '24:00'], ['2026-01-01', '9:30'], ['2026-01-01', '09:60'], ['', ''],
  ])('rejects invalid or unsupported local date/time %s %s', (date, time) => {
    expect(getEasternTimeOptions(date, time)).toEqual([])
  })
  test('keeps calendar day and time Eastern near UTC midnight', () => {
    expect(appointmentCalendarDate('2026-07-11T01:30:00Z')).toBe('2026-07-10')
    expect(appointmentTimeLabel('2026-07-11T01:30:00Z')).toBe('9:30 PM EDT')
    expect(formatAppointmentDateTime('2026-01-10T14:30:00.000Z')).toBe('Jan 10, 2026, 9:30 AM EST')
  })
  test.each(['2026-02-30T09:30:00Z', '2026-01-01', '2026-01-01T09:30:00', '2026-01-01T24:00:00Z', 'not a date', '', '2026-01-01T09:30:00+02:00'])('rejects malformed UTC instant %s', value => {
    expect(appointmentCalendarDate(value)).toBeNull()
    expect(appointmentTimeLabel(value)).toBe('—')
    expect(formatAppointmentDateTime(value)).toBe('—')
  })
  test('resets optional choices and all editable draft fields', () => {
    expect(emptyAppointmentRequest()).toEqual({ title: '', contact: null, meetingFormat: null, preferredDate: '', preferredTime: '', preferredOffsetMinutes: null, agenda: '' })
    expect(emptyAppointmentReschedule()).toEqual({ reason: '', suggestedDate: '', suggestedTime: '', suggestedOffsetMinutes: null })
  })
  test('keeps upper-bound local times inside the supported UTC range', () => {
    expect(getEasternTimeOptions('9999-12-31', '18:59')).toMatchObject([{ dateTime: '9999-12-31T23:59:00.000Z' }])
    expect(getEasternTimeOptions('9999-12-31', '23:59')).toEqual([])
    expect(getEasternTimeOptions('10000-01-01', '09:30')).toEqual([])
    expect(appointmentCalendarDate('1752-12-31T23:59:59Z')).toBeNull()
    expect(appointmentCalendarDate('1753-01-01T12:00:00Z')).toBe('1753-01-01')
  })
  test('accepts Dataverse fractional seconds while rejecting invalid leap/calendar instants', () => {
    expect(appointmentCalendarDate('2026-07-11T01:30:00.1234567Z')).toBe('2026-07-10')
    expect(appointmentCalendarDate('2024-02-29T12:00:00Z')).toBe('2024-02-29')
    expect(appointmentCalendarDate('2025-02-29T12:00:00Z')).toBeNull()
    expect(appointmentCalendarDate('2026-07-11T01:30:60Z')).toBeNull()
  })
})
