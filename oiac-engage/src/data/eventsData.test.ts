import { describe, expect, test } from 'vitest'
import { eventCalendarDate, eventDateLabel, eventLocationLabel } from './eventsData'

describe('Events presentation data', () => {
  test('formats a same-day Dataverse date/time range', () => {
    expect(eventDateLabel('2026-09-16T18:00:00Z', '2026-09-16T19:30:00Z')).toMatch(
      /^Sep 16, 2026, .+–.+$/,
    )
  })

  test('uses venue and virtual format details for the location label', () => {
    expect(eventLocationLabel('In Person', 'District Office Meeting Room', null)).toBe(
      'District Office Meeting Room',
    )
    expect(eventLocationLabel('Virtual', null, 'https://teams.microsoft.com/example')).toBe('Online meeting')
    expect(eventLocationLabel('Hybrid', 'Community Center', 'https://teams.microsoft.com/example')).toBe(
      'Community Center / Online',
    )
  })

  test('handles unscheduled events and groups timestamps by the browser local date', () => {
    expect(eventDateLabel(null, null)).toBe('Date to be announced')
    expect(eventCalendarDate(null)).toBeNull()

    const timestamp = '2026-09-16T23:30:00-11:00'
    const local = new Date(timestamp)
    const expected = [
      local.getFullYear(),
      String(local.getMonth() + 1).padStart(2, '0'),
      String(local.getDate()).padStart(2, '0'),
    ].join('-')
    expect(eventCalendarDate(timestamp)).toBe(expected)
  })
})
