import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getCalendarEvents } from '../events/eventService'
import type { EventItem } from '../events/eventTypes'
import { getEventRegistrations } from '../eventRegistrations/eventRegistrationService'
import { EVENT_REGISTRATION_STATUS } from '../eventRegistrations/eventRegistrationTypes'
import { getMeetingReportCount, getMeetingReports } from '../meetingReports/meetingReportService'
import { useHomeDashboardData } from './useHomeDashboardData'

vi.mock('../events/eventService', () => ({ getCalendarEvents: vi.fn() }))
vi.mock('../eventRegistrations/eventRegistrationService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../eventRegistrations/eventRegistrationService')>()
  return { ...original, getEventRegistrations: vi.fn() }
})
vi.mock('../meetingReports/meetingReportService', () => ({
  getMeetingReportCount: vi.fn(),
  getMeetingReports: vi.fn(),
}))

const contactId = '11111111-1111-1111-1111-111111111111'
const activeEventId = '22222222-2222-2222-2222-222222222222'
const secondEventId = '33333333-3333-3333-3333-333333333333'
const cancelledEventId = '44444444-4444-4444-4444-444444444444'
const waitlistedEventId = '55555555-5555-5555-5555-555555555555'

function event(id: string, title: string): EventItem {
  return {
    id,
    title,
    eventFormat: 'Virtual',
    eventFormatValue: 866530001,
    eventStatus: 'Registration Open',
    eventStatusValue: 866530002,
    eventType: 'Meeting',
    eventTypeValue: 866530002,
    startDateTime: '2026-09-16T18:00:00Z',
    endDateTime: '2026-09-16T19:00:00Z',
    meetingUrl: 'https://example.com/meeting',
    venueName: null,
    description: null,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getMeetingReports).mockResolvedValue({
    reports: [{
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      subject: 'District briefing',
      representativeName: 'Representative One',
      date: '2026-08-30T12:00:00Z',
      sentimentLabel: 'Supportive',
    }],
    hasNext: false,
    nextLink: null,
  })
  vi.mocked(getMeetingReportCount).mockResolvedValue(7)
  vi.mocked(getEventRegistrations).mockResolvedValue([
    {
      id: 'aaaaaaaa-1111-1111-1111-111111111111',
      contactId,
      eventId: activeEventId,
      registrationDate: '2026-08-31T12:00:00Z',
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.registered,
    },
    {
      id: 'bbbbbbbb-1111-1111-1111-111111111111',
      contactId,
      eventId: activeEventId,
      registrationDate: '2026-08-31T12:01:00Z',
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.registered,
    },
    {
      id: 'cccccccc-1111-1111-1111-111111111111',
      contactId,
      eventId: secondEventId,
      registrationDate: '2026-08-31T12:02:00Z',
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.registered,
    },
    {
      id: 'dddddddd-1111-1111-1111-111111111111',
      contactId,
      eventId: cancelledEventId,
      registrationDate: '2026-08-31T12:03:00Z',
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.cancelled,
    },
    {
      id: 'eeeeeeee-1111-1111-1111-111111111111',
      contactId,
      eventId: waitlistedEventId,
      registrationDate: '2026-08-31T12:04:00Z',
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.waitlisted,
    },
  ])
  vi.mocked(getCalendarEvents).mockResolvedValue([
    event(activeEventId, 'First registered event'),
    event(secondEventId, 'Second registered event'),
  ])
})

test('loads live report KPIs and only unique Registered events for the signed-in Contact', async () => {
  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => {
    expect(result.current.reportsStatus).toBe('ready')
    expect(result.current.registrationsStatus).toBe('ready')
  })

  expect(result.current.reportCount).toBe(7)
  expect(result.current.reports).toHaveLength(1)
  expect(result.current.registeredEventCount).toBe(2)
  expect(result.current.upcomingEvents.map((item) => item.id)).toEqual([activeEventId, secondEventId])
  expect(getMeetingReports).toHaveBeenCalledWith({ limit: 5 }, expect.any(AbortSignal))
  expect(getMeetingReportCount).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(getEventRegistrations).toHaveBeenCalledWith(contactId, expect.any(AbortSignal))
  expect(getCalendarEvents).toHaveBeenCalledWith(
    [activeEventId, secondEventId],
    expect.any(AbortSignal),
  )
})

test('returns a friendly-ready empty event state when the Contact has no active registrations', async () => {
  vi.mocked(getEventRegistrations).mockResolvedValue([])

  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.registrationsStatus).toBe('ready'))
  expect(result.current.registeredEventCount).toBe(0)
  expect(result.current.upcomingEvents).toEqual([])
  expect(getCalendarEvents).not.toHaveBeenCalled()
})

test('keeps the latest reports available if only the report count request fails', async () => {
  vi.mocked(getMeetingReportCount).mockRejectedValue(new Error('count unavailable'))

  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.reportsStatus).toBe('ready'))
  expect(result.current.reports).toHaveLength(1)
  expect(result.current.reportCount).toBeNull()
})

test('keeps the registration KPI when only registered Event details fail', async () => {
  vi.mocked(getCalendarEvents).mockRejectedValue(new Error('event details unavailable'))

  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.registrationsStatus).toBe('error'))
  expect(result.current.registeredEventCount).toBe(2)
  expect(result.current.upcomingEvents).toEqual([])
})

test('aborts all dashboard requests when Home unmounts', () => {
  const { unmount } = renderHook(() => useHomeDashboardData(contactId))
  const reportListSignal = vi.mocked(getMeetingReports).mock.calls[0][1]
  const reportCountSignal = vi.mocked(getMeetingReportCount).mock.calls[0][0]
  const registrationsSignal = vi.mocked(getEventRegistrations).mock.calls[0][1]

  unmount()

  expect(reportListSignal?.aborted).toBe(true)
  expect(reportCountSignal?.aborted).toBe(true)
  expect(registrationsSignal?.aborted).toBe(true)
})
