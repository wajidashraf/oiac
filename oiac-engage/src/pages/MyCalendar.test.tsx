import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { EVENT_REGISTRATION_STATUS } from '../features/eventRegistrations/eventRegistrationService'
import type { EventRegistration } from '../features/eventRegistrations/eventRegistrationTypes'
import type { EventItem } from '../features/events/eventTypes'
import {
  MEETING_INVITATION_STATUS,
  type MeetingInvitationStatus,
  type MeetingInvite,
  type MeetingInviteCollection,
} from '../features/meetingInvites/meetingInviteTypes'
import MyCalendar from './MyCalendar'

const contactId = '11111111-1111-4111-8111-111111111111'
const registeredEventId = '22222222-2222-4222-8222-222222222222'
const waitlistedEventId = '33333333-3333-4333-8333-333333333333'
const secondRegisteredEventId = '66666666-6666-4666-8666-666666666666'

const registrations: readonly EventRegistration[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    contactId,
    eventId: registeredEventId,
    registrationDate: '2026-08-30T12:00:00Z',
    registrationNumber: 'REG-1001',
    status: EVENT_REGISTRATION_STATUS.registered,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    contactId,
    eventId: waitlistedEventId,
    registrationDate: '2026-08-30T12:10:00Z',
    registrationNumber: 'REG-1002',
    status: EVENT_REGISTRATION_STATUS.waitlisted,
  },
]

const registeredEvent: EventItem = {
  id: registeredEventId,
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

function meetingInvite(
  id: string,
  title: string,
  startDateTime: string,
  status: MeetingInvitationStatus | null,
): MeetingInvite {
  return {
    id,
    title,
    startDateTime,
    endDateTime: null,
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/calendar-meeting',
    participant: status === null ? null : {
      id: `${id.slice(0, 24)}999999999999`,
      contactId,
      meetingInviteId: id,
      status,
      acceptedOn: status === MEETING_INVITATION_STATUS.accepted
        ? '2026-08-01T12:00:00Z'
        : null,
      name: `${title} - Sara Rahimi`,
    },
  }
}

function renderCalendar({
  loadRegistrations = vi.fn().mockResolvedValue(registrations),
  loadRegisteredEvents = vi.fn().mockResolvedValue([registeredEvent]),
  loadMeetingInvites = vi.fn().mockResolvedValue({ contactFullName: 'Sara Rahimi', invites: [] }),
}: {
  loadRegistrations?: (contactId: string, signal?: AbortSignal) => Promise<readonly EventRegistration[]>
  loadRegisteredEvents?: (eventIds: readonly string[], signal?: AbortSignal) => Promise<readonly EventItem[]>
  loadMeetingInvites?: (contactId: string, signal?: AbortSignal) => Promise<MeetingInviteCollection>
} = {}) {
  return render(
    <MemoryRouter>
      <MyCalendar
        contactId={contactId}
        initialMonth={new Date(2026, 8, 1)}
        acceptedItems={[]}
        loadRegistrations={loadRegistrations}
        loadRegisteredEvents={loadRegisteredEvents}
        loadMeetingInvites={loadMeetingInvites}
      />
    </MemoryRouter>,
  )
}

describe('My Calendar', () => {
  test('loads only Registered event details and renders them in the grid and upcoming list', async () => {
    const loadRegistrations = vi.fn().mockResolvedValue(registrations)
    const loadRegisteredEvents = vi.fn().mockResolvedValue([registeredEvent])
    renderCalendar({ loadRegistrations, loadRegisteredEvents })

    expect(screen.getByRole('status')).toHaveTextContent('Loading your calendar')
    const grid = await screen.findByRole('grid', { name: 'September 2026 calendar' })
    expect(within(grid).getByRole('link', { name: /Join Volunteer Orientation Webinar/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Join Volunteer Orientation Webinar/i })).toHaveLength(2)
    expect(loadRegistrations).toHaveBeenCalledWith(contactId, expect.any(AbortSignal))
    expect(loadRegisteredEvents).toHaveBeenCalledWith(
      [registeredEventId],
      expect.any(AbortSignal),
    )
    expect(loadRegisteredEvents).not.toHaveBeenCalledWith(
      expect.arrayContaining([waitlistedEventId]),
      expect.any(AbortSignal),
    )
    expect(document.title).toBe('My Calendar — OIAC Engage')
  })

  test('renders past and future registered Events with past and future accepted meetings', async () => {
    const pastEvent = {
      ...registeredEvent,
      id: registeredEventId,
      title: 'Past Registered Event',
      startDateTime: '2026-08-08T18:00:00Z',
      endDateTime: '2026-08-08T19:00:00Z',
    }
    const futureEvent = {
      ...registeredEvent,
      id: secondRegisteredEventId,
      title: 'Future Registered Event',
      startDateTime: '2026-10-22T18:00:00Z',
      endDateTime: '2026-10-22T19:00:00Z',
    }
    const pastMeeting = meetingInvite(
      '77777777-7777-4777-8777-777777777777',
      'Past Accepted Meeting',
      '2026-08-09T18:00:00Z',
      MEETING_INVITATION_STATUS.accepted,
    )
    const futureMeeting = meetingInvite(
      '88888888-8888-4888-8888-888888888888',
      'Future Accepted Meeting',
      '2026-10-23T18:00:00Z',
      MEETING_INVITATION_STATUS.accepted,
    )
    const loadRegistrations = vi.fn().mockResolvedValue([
      registrations[0],
      {
        ...registrations[0],
        id: '99999999-9999-4999-8999-999999999999',
        eventId: secondRegisteredEventId,
      },
    ])
    const loadRegisteredEvents = vi.fn().mockResolvedValue([pastEvent, futureEvent])
    const loadMeetingInvites = vi.fn().mockResolvedValue({
      contactFullName: 'Sara Rahimi',
      invites: [pastMeeting, futureMeeting],
    })

    const user = userEvent.setup()
    renderCalendar({ loadRegistrations, loadRegisteredEvents, loadMeetingInvites })

    await screen.findByRole('grid', { name: 'September 2026 calendar' })
    await user.click(screen.getByRole('button', { name: 'Show August 2026' }))
    const pastGrid = screen.getByRole('grid', { name: 'August 2026 calendar' })
    expect(within(pastGrid).getByText('Past Registered Event')).toBeInTheDocument()
    expect(within(pastGrid).getByText('Past Accepted Meeting')).toBeInTheDocument()
    expect(screen.getAllByText('Past Registered Event')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Show September 2026' }))
    await user.click(screen.getByRole('button', { name: 'Show October 2026' }))
    const futureGrid = screen.getByRole('grid', { name: 'October 2026 calendar' })
    expect(within(futureGrid).getByText('Future Registered Event')).toBeInTheDocument()
    expect(within(futureGrid).getByText('Future Accepted Meeting')).toBeInTheDocument()
    expect(screen.getAllByText('Future Accepted Meeting')).toHaveLength(2)
    expect(loadRegisteredEvents).toHaveBeenCalledWith(
      [registeredEventId, secondRegisteredEventId],
      expect.any(AbortSignal),
    )
    expect(loadMeetingInvites).toHaveBeenCalledWith(contactId, expect.any(AbortSignal))
  })

  test('excludes pending, rejected, and unanswered Meeting Invites', async () => {
    const accepted = meetingInvite(
      '77777777-7777-4777-8777-777777777777',
      'Accepted Meeting',
      '2026-09-09T18:00:00Z',
      MEETING_INVITATION_STATUS.accepted,
    )
    const pending = meetingInvite(
      '88888888-8888-4888-8888-888888888888',
      'Pending Meeting',
      '2026-09-10T18:00:00Z',
      MEETING_INVITATION_STATUS.pending,
    )
    const rejected = meetingInvite(
      '99999999-9999-4999-8999-999999999999',
      'Rejected Meeting',
      '2026-09-11T18:00:00Z',
      MEETING_INVITATION_STATUS.rejected,
    )
    const unanswered = meetingInvite(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Unanswered Meeting',
      '2026-09-12T18:00:00Z',
      null,
    )

    renderCalendar({
      loadRegistrations: vi.fn().mockResolvedValue([]),
      loadMeetingInvites: vi.fn().mockResolvedValue({
        contactFullName: 'Sara Rahimi',
        invites: [accepted, pending, rejected, unanswered],
      }),
    })

    const grid = await screen.findByRole('grid', { name: 'September 2026 calendar' })
    expect(within(grid).getByText('Accepted Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Pending Meeting')).not.toBeInTheDocument()
    expect(screen.queryByText('Rejected Meeting')).not.toBeInTheDocument()
    expect(screen.queryByText('Unanswered Meeting')).not.toBeInTheDocument()
  })

  test('aborts the active registration request when My Calendar unmounts', () => {
    let requestSignal: AbortSignal | undefined
    let meetingRequestSignal: AbortSignal | undefined
    const loadRegistrations = vi.fn((_contactId: string, signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<readonly EventRegistration[]>(() => undefined)
    })
    const loadMeetingInvites = vi.fn((_contactId: string, signal?: AbortSignal) => {
      meetingRequestSignal = signal
      return Promise.resolve({ contactFullName: 'Sara Rahimi', invites: [] })
    })
    const view = renderCalendar({ loadRegistrations, loadMeetingInvites })

    expect(requestSignal?.aborted).toBe(false)
    expect(meetingRequestSignal?.aborted).toBe(false)
    view.unmount()
    expect(requestSignal?.aborted).toBe(true)
    expect(meetingRequestSignal?.aborted).toBe(true)
  })

  test('renders an in-person event without a safe meeting URL as non-link content', async () => {
    renderCalendar({
      loadRegisteredEvents: vi.fn().mockResolvedValue([{
        ...registeredEvent,
        eventFormat: 'In Person',
        eventFormatValue: 866530000,
        meetingUrl: 'javascript:alert(1)',
        venueName: 'District Office Meeting Room',
      }]),
    })

    const grid = await screen.findByRole('grid', { name: 'September 2026 calendar' })
    expect(within(grid).getByText('Volunteer Orientation Webinar')).toBeInTheDocument()
    expect(within(grid).queryByRole('link', { name: /Volunteer Orientation Webinar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/District Office Meeting Room/)).toBeInTheDocument()
  })

  test('moves between months and explains a month with no registered items', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await screen.findByRole('grid', { name: 'September 2026 calendar' })

    await user.click(screen.getByRole('button', { name: 'Show October 2026' }))

    expect(screen.getByRole('grid', { name: 'October 2026 calendar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No upcoming items this month', level: 3 })).toBeInTheDocument()
  })

  test('shows an empty calendar state when the Contact has no eligible records', async () => {
    const loadRegisteredEvents = vi.fn()
    renderCalendar({
      loadRegistrations: vi.fn().mockResolvedValue([
        { ...registrations[1], status: EVENT_REGISTRATION_STATUS.waitlisted },
      ]),
      loadRegisteredEvents,
    })

    expect(await screen.findByRole('heading', {
      name: 'No registered events or accepted meetings yet',
    })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse events' })).toHaveAttribute('href', '/activity/events')
    expect(loadRegisteredEvents).not.toHaveBeenCalled()
  })

  test('shows a retry action when registrations or event details cannot be loaded', async () => {
    const user = userEvent.setup()
    const loadRegistrations = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(registrations)
    const loadRegisteredEvents = vi.fn().mockResolvedValue([registeredEvent])
    renderCalendar({ loadRegistrations, loadRegisteredEvents })

    expect(await screen.findByRole('heading', { name: 'Your calendar could not be loaded' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(loadRegistrations).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('grid', { name: 'September 2026 calendar' })).toBeInTheDocument()
  })

  test('retries both calendar branches when Meeting Invites cannot be loaded', async () => {
    const user = userEvent.setup()
    const loadRegistrations = vi.fn().mockResolvedValue(registrations)
    const loadRegisteredEvents = vi.fn().mockResolvedValue([registeredEvent])
    const loadMeetingInvites = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({ contactFullName: 'Sara Rahimi', invites: [] })
    renderCalendar({ loadRegistrations, loadRegisteredEvents, loadMeetingInvites })

    expect(await screen.findByRole('heading', { name: 'Your calendar could not be loaded' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('grid', { name: 'September 2026 calendar' })).toBeInTheDocument()
    expect(loadMeetingInvites).toHaveBeenCalledTimes(2)
    expect(loadRegistrations).toHaveBeenCalledTimes(2)
    expect(loadRegisteredEvents).toHaveBeenCalledTimes(2)
  })
})
