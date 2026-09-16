import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getCalendarEvents } from '../events/eventService'
import type { EventItem } from '../events/eventTypes'
import { getEventRegistrations } from '../eventRegistrations/eventRegistrationService'
import { EVENT_REGISTRATION_STATUS } from '../eventRegistrations/eventRegistrationTypes'
import { listMeetingReportPageAttachments } from '../meetingReports/meetingReportAttachmentService'
import { getMeetingReportCount, getMeetingReports } from '../meetingReports/meetingReportService'
import {
  acceptMeetingInvite,
  getMeetingInvites,
  MEETING_INVITATION_STATUS,
} from '../meetingInvites/meetingInviteService'
import type { MeetingInvite } from '../meetingInvites/meetingInviteTypes'
import { getActiveTeamAnnouncements } from '../teamAnnouncements/teamAnnouncementService'
import type { TeamAnnouncement } from '../teamAnnouncements/teamAnnouncementTypes'
import { PowerPagesApiError, PowerPagesDataError } from '../../shared/powerPagesApi'
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
vi.mock('../meetingReports/meetingReportAttachmentService', () => ({
  listMeetingReportPageAttachments: vi.fn(),
}))
vi.mock('../meetingInvites/meetingInviteService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../meetingInvites/meetingInviteService')>()
  return {
    ...original,
    acceptMeetingInvite: vi.fn(),
    getMeetingInvites: vi.fn(),
  }
})
vi.mock('../teamAnnouncements/teamAnnouncementService', () => ({
  getActiveTeamAnnouncements: vi.fn(),
}))

const contactId = '11111111-1111-1111-1111-111111111111'
const activeEventId = '22222222-2222-2222-2222-222222222222'
const secondEventId = '33333333-3333-3333-3333-333333333333'
const cancelledEventId = '44444444-4444-4444-4444-444444444444'
const waitlistedEventId = '55555555-5555-5555-5555-555555555555'
const inviteId = '66666666-6666-4666-8666-666666666666'
const participantId = '77777777-7777-4777-8777-777777777777'
const teamAnnouncement: TeamAnnouncement = {
  id: '88888888-8888-4888-8888-888888888888',
  title: 'Advocacy briefing update',
  content: 'The latest materials are ready.',
  startDateTime: '2026-09-12T12:00:00Z',
  endDateTime: '2026-09-13T12:00:00Z',
  link: 'https://example.com/briefing',
}

const meetingInvite: MeetingInvite = {
  id: inviteId,
  title: 'District Briefing',
  startDateTime: '2099-09-18T18:00:00Z',
  endDateTime: '2099-09-18T19:00:00Z',
  meetingLink: 'https://teams.microsoft.com/l/meetup-join/district-briefing',
  participant: null,
}

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
      districtName: 'DC',
      date: '2026-08-30T12:00:00Z',
      sentimentLabel: 'Supportive',
    }],
    hasNext: false,
    nextLink: null,
  })
  vi.mocked(getMeetingReportCount).mockResolvedValue(7)
  vi.mocked(listMeetingReportPageAttachments).mockResolvedValue(new Map([[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    [{
      meetingReportId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      attachmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fileName: 'District briefing.pdf',
      contentType: 'application/pdf',
      size: 2048,
    }],
  ]]))
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
  vi.mocked(getMeetingInvites).mockResolvedValue({
    contactFullName: 'Sara Rahimi',
    invites: [meetingInvite],
  })
  vi.mocked(acceptMeetingInvite).mockResolvedValue({
    id: participantId,
    contactId,
    meetingInviteId: inviteId,
    status: MEETING_INVITATION_STATUS.accepted,
    acceptedOn: '2026-09-12T14:30:00.000Z',
    name: 'District Briefing - Sara Rahimi',
  })
  vi.mocked(getActiveTeamAnnouncements).mockResolvedValue([teamAnnouncement])
})

test('loads live report KPIs and only unique Registered events for the signed-in Contact', async () => {
  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => {
    expect(result.current.reportsStatus).toBe('ready')
    expect(result.current.registrationsStatus).toBe('ready')
  })

  expect(result.current.reportCount).toBe(7)
  expect(result.current.reports).toHaveLength(1)
  expect(result.current.reports[0].districtName).toBe('DC')
  expect(listMeetingReportPageAttachments).not.toHaveBeenCalled()
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
  expect(result.current.registrationsFailureKind).toBeNull()
  expect(getCalendarEvents).not.toHaveBeenCalled()
})

test('classifies registration API failures without failing other dashboard widgets', async () => {
  vi.mocked(getEventRegistrations).mockRejectedValue(new PowerPagesApiError('Unavailable', 503))

  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.registrationsStatus).toBe('error'))
  await waitFor(() => expect(result.current.invitesStatus).toBe('ready'))
  expect(result.current.registrationsFailureKind).toBe('api')
  expect(result.current.reportsStatus).toBe('ready')
  expect(result.current.announcementsStatus).toBe('ready')
})

test('classifies invite processing failures without failing other dashboard widgets', async () => {
  vi.mocked(getMeetingInvites).mockRejectedValue(new PowerPagesDataError())

  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.invitesStatus).toBe('error'))
  await waitFor(() => expect(result.current.registrationsStatus).toBe('ready'))
  expect(result.current.invitesFailureKind).toBe('processing')
  expect(result.current.reportsStatus).toBe('ready')
  expect(result.current.announcementsStatus).toBe('ready')
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
  const invitationsSignal = vi.mocked(getMeetingInvites).mock.calls[0][1]
  const announcementsSignal = vi.mocked(getActiveTeamAnnouncements).mock.calls[0][0]?.signal

  unmount()

  expect(reportListSignal?.aborted).toBe(true)
  expect(reportCountSignal?.aborted).toBe(true)
  expect(registrationsSignal?.aborted).toBe(true)
  expect(invitationsSignal?.aborted).toBe(true)
  expect(announcementsSignal?.aborted).toBe(true)
})

test('loads Teams announcements independently of the signed-in Contact', async () => {
  const { result } = renderHook(() => useHomeDashboardData())

  await waitFor(() => expect(result.current.announcementsStatus).toBe('ready'))

  expect(result.current.teamAnnouncements).toEqual([teamAnnouncement])
  expect(getActiveTeamAnnouncements).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
})

test('keeps other dashboard data ready when Teams announcements fail', async () => {
  vi.mocked(getActiveTeamAnnouncements).mockRejectedValue(new Error('announcements unavailable'))
  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => {
    expect(result.current.announcementsStatus).toBe('error')
    expect(result.current.reportsStatus).toBe('ready')
    expect(result.current.invitesStatus).toBe('ready')
  })

  expect(result.current.teamAnnouncements).toEqual([])
  expect(result.current.reports).toHaveLength(1)
  expect(result.current.meetingInvites).toEqual([meetingInvite])
})

test('retries only Teams announcements without reloading other dashboard data', async () => {
  vi.mocked(getActiveTeamAnnouncements)
    .mockRejectedValueOnce(new Error('temporary failure'))
    .mockResolvedValueOnce([teamAnnouncement])
  const { result } = renderHook(() => useHomeDashboardData(contactId))
  await waitFor(() => expect(result.current.announcementsStatus).toBe('error'))
  const reportCalls = vi.mocked(getMeetingReports).mock.calls.length
  const inviteCalls = vi.mocked(getMeetingInvites).mock.calls.length

  act(() => result.current.retryAnnouncements())

  await waitFor(() => expect(result.current.announcementsStatus).toBe('ready'))
  expect(result.current.teamAnnouncements).toEqual([teamAnnouncement])
  expect(getActiveTeamAnnouncements).toHaveBeenCalledTimes(2)
  expect(getMeetingReports).toHaveBeenCalledTimes(reportCalls)
  expect(getMeetingInvites).toHaveBeenCalledTimes(inviteCalls)
})

test('loads eligible meeting invites independently for the signed-in Contact', async () => {
  const { result } = renderHook(() => useHomeDashboardData(contactId))

  await waitFor(() => expect(result.current.invitesStatus).toBe('ready'))
  expect(result.current.meetingInvites).toEqual([meetingInvite])
  expect(result.current.invitesFailureKind).toBeNull()
  expect(result.current.inviteError).toBeNull()
  expect(getMeetingInvites).toHaveBeenCalledWith(contactId, expect.any(AbortSignal))
})

test('derives every future meeting in ascending order without removing past invites upstream', async () => {
  const pastInvite: MeetingInvite = {
    ...meetingInvite,
    id: '88888888-6666-4666-8666-666666666666',
    title: 'Past District Briefing',
    startDateTime: '2000-09-18T18:00:00Z',
    endDateTime: '2000-09-18T19:00:00Z',
  }
  const soonerFutureInvite: MeetingInvite = {
    ...meetingInvite,
    id: '55555555-6666-4666-8666-666666666666',
    title: 'Sooner Future Briefing',
    startDateTime: '2099-09-16T18:00:00Z',
    endDateTime: '2099-09-16T19:00:00Z',
  }
  vi.mocked(getMeetingInvites).mockResolvedValueOnce({
    contactFullName: 'Sara Rahimi',
    invites: [meetingInvite, pastInvite, soonerFutureInvite],
  })

  const { result } = renderHook(() => useHomeDashboardData(contactId))
  await waitFor(() => expect(result.current.invitesStatus).toBe('ready'))

  expect(result.current.meetingInvites.map(({ id }) => id)).toEqual([
    meetingInvite.id,
    pastInvite.id,
    soonerFutureInvite.id,
  ])
  expect(result.current.upcomingMeetings.map(({ id }) => id)).toEqual([
    soonerFutureInvite.id,
    meetingInvite.id,
  ])
})

test('accepts one invite, locks repeat requests synchronously, and updates only that row', async () => {
  let resolveAccept!: (value: Awaited<ReturnType<typeof acceptMeetingInvite>>) => void
  vi.mocked(acceptMeetingInvite).mockReturnValue(new Promise((resolve) => {
    resolveAccept = resolve
  }))
  const { result } = renderHook(() => useHomeDashboardData(contactId))
  await waitFor(() => expect(result.current.invitesStatus).toBe('ready'))

  let first!: Promise<void>
  let repeated!: Promise<void>
  act(() => {
    first = result.current.acceptInvite(inviteId)
    repeated = result.current.acceptInvite(inviteId)
  })
  await repeated
  expect(result.current.acceptingInviteIds.has(inviteId)).toBe(true)
  expect(acceptMeetingInvite).toHaveBeenCalledTimes(1)

  await act(async () => {
    resolveAccept({
      id: participantId,
      contactId,
      meetingInviteId: inviteId,
      status: MEETING_INVITATION_STATUS.accepted,
      acceptedOn: '2026-09-12T14:30:00.000Z',
      name: 'District Briefing - Sara Rahimi',
    })
    await first
  })

  expect(result.current.meetingInvites[0].participant?.status).toBe(MEETING_INVITATION_STATUS.accepted)
  expect(result.current.upcomingMeetings[0].participant?.status).toBe(MEETING_INVITATION_STATUS.accepted)
  expect(result.current.acceptingInviteIds.has(inviteId)).toBe(false)
})

test('exposes a row-specific invitation error and retries invitations without reloading other dashboard data', async () => {
  vi.mocked(acceptMeetingInvite).mockRejectedValue(new Error('write failed'))
  const { result } = renderHook(() => useHomeDashboardData(contactId))
  await waitFor(() => expect(result.current.invitesStatus).toBe('ready'))

  await act(async () => {
    await result.current.acceptInvite(inviteId)
  })
  expect(result.current.inviteError).toBe('District Briefing could not be accepted. Try again.')

  const reportsCalls = vi.mocked(getMeetingReports).mock.calls.length
  await act(async () => result.current.retryInvites())
  await waitFor(() => expect(getMeetingInvites).toHaveBeenCalledTimes(2))
  expect(getMeetingReports).toHaveBeenCalledTimes(reportsCalls)
})
