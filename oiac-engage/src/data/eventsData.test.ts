import { describe, expect, test } from 'vitest'
import { eventDateLabel, eventItems } from './eventsData'

describe('Events data', () => {
  test('contains the six standalone reference events in display order', () => {
    expect(eventItems).toHaveLength(6)
    expect(eventItems.map((item) => item.title)).toEqual([
      'OIAC National Convention 2026',
      'Iranian American Rights Rally — Los Angeles',
      'Capitol Hill Advocacy Day',
      'Volunteer Captain Briefing',
      'State Coalition Summit — Texas',
      'Iranian American Heritage Month Kickoff',
    ])
    expect(eventItems.map((item) => item.category)).toEqual([
      'Convention',
      'Rally',
      'Advocacy Day',
      'Briefing',
      'Convention',
      'Rally',
    ])
  })

  test('keeps the reference status and registration states separate from My Calendar', () => {
    expect(eventItems.map(({ id, status, registered }) => ({ id, status, registered }))).toEqual([
      { id: 'directory-event-001', status: 'Registration Open', registered: true },
      { id: 'directory-event-002', status: 'Upcoming', registered: false },
      { id: 'directory-event-003', status: 'Upcoming', registered: true },
      { id: 'directory-event-004', status: 'Registration Open', registered: false },
      { id: 'directory-event-005', status: 'Completed', registered: false },
      { id: 'directory-event-006', status: 'Upcoming', registered: false },
    ])
  })

  test('formats an ISO date without timezone drift', () => {
    expect(eventDateLabel('2026-09-08')).toBe('Sep 8')
  })
})
