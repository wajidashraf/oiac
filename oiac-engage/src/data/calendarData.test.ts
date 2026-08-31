import { describe, expect, test } from 'vitest'
import type { EventItem } from '../features/events/eventTypes'
import {
  buildMonthCells,
  eventToCalendarItem,
  itemsForMonth,
  monthLabel,
  type CalendarItem,
} from './calendarData'

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

  test('maps a registered Dataverse event into a calendar item', () => {
    const event: EventItem = {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Volunteer Orientation Webinar',
      eventFormat: 'Virtual',
      eventFormatValue: 866530001,
      eventStatus: 'Registration Closed',
      eventStatusValue: 866530003,
      eventType: 'Webinar',
      eventTypeValue: 866530005,
      startDateTime: '2026-09-16T18:00:00Z',
      endDateTime: '2026-09-16T19:30:00Z',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/orientation',
      venueName: null,
      description: null,
    }

    expect(eventToCalendarItem(event)).toEqual({
      id: event.id,
      date: '2026-09-16',
      title: event.title,
      kind: 'event',
      status: 'Registered',
      time: '9:00 PM–10:30 PM',
      location: 'Online meeting',
      joinUrl: event.meetingUrl,
    })
  })

  test('rejects unsafe meeting links and events without a valid start date', () => {
    const event = {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Community Meeting',
      eventFormat: 'In Person',
      eventFormatValue: 866530000,
      eventStatus: 'Published',
      eventStatusValue: 866530001,
      eventType: 'Meeting',
      eventTypeValue: 866530002,
      startDateTime: '2026-09-22T17:30:00Z',
      endDateTime: '2026-09-22T19:00:00Z',
      meetingUrl: 'javascript:alert(1)',
      venueName: 'District Office Meeting Room',
      description: null,
    } satisfies EventItem

    expect(eventToCalendarItem(event)).toMatchObject({
      location: 'District Office Meeting Room',
      joinUrl: null,
    })
    expect(eventToCalendarItem({ ...event, startDateTime: null })).toBeNull()
  })
})
