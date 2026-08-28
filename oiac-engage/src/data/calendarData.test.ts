import { describe, expect, test } from 'vitest'
import { buildMonthCells, itemsForMonth, monthLabel, type CalendarItem } from './calendarData'

const records: readonly CalendarItem[] = [
  {
    id: 'meeting-002',
    date: '2026-09-18',
    title: 'Congressional Outreach Training Session',
    kind: 'meeting',
    status: 'Accepted',
    time: '2:00 PM ET',
    location: 'Microsoft Teams',
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/example',
  },
  {
    id: 'event-001',
    date: '2026-09-08',
    title: 'Capitol Hill Advocacy Day',
    kind: 'event',
    status: 'Registered',
    time: 'All Day',
    location: 'Washington, D.C.',
    joinUrl: 'https://outlook.office.com/calendar/item/example',
  },
  {
    id: 'event-003',
    date: '2026-10-15',
    title: 'OIAC National Convention 2026',
    kind: 'event',
    status: 'Registered',
    time: 'All Day',
    location: 'Washington, D.C.',
    joinUrl: 'https://outlook.office.com/calendar/item/convention',
  },
]

describe('calendar date helpers', () => {
  test('builds the complete Sunday-first grid for September 2026', () => {
    const cells = buildMonthCells(2026, 8)

    expect(cells).toHaveLength(35)
    expect(cells.slice(0, 2)).toEqual([null, null])
    expect(cells[2]).toEqual({ day: 1, isoDate: '2026-09-01' })
    expect(cells[31]).toEqual({ day: 30, isoDate: '2026-09-30' })
    expect(cells.slice(32)).toEqual([null, null, null])
  })

  test('filters and sorts items for the selected month without mutating input', () => {
    const septemberItems = itemsForMonth(records, 2026, 8)

    expect(septemberItems.map((item) => item.id)).toEqual(['event-001', 'meeting-002'])
    expect(records.map((item) => item.id)).toEqual(['meeting-002', 'event-001', 'event-003'])
  })

  test('formats a stable English month heading', () => {
    expect(monthLabel(2026, 8)).toBe('September 2026')
  })
})
