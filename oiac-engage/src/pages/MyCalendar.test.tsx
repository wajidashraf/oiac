import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { EVENT_REGISTRATION_STATUS } from '../features/eventRegistrations/eventRegistrationService'
import type { EventRegistration } from '../features/eventRegistrations/eventRegistrationTypes'
import type { EventItem } from '../features/events/eventTypes'
import MyCalendar from './MyCalendar'

const contactId = '11111111-1111-4111-8111-111111111111'
const registeredEventId = '22222222-2222-4222-8222-222222222222'
const waitlistedEventId = '33333333-3333-4333-8333-333333333333'

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

function renderCalendar({
  loadRegistrations = vi.fn().mockResolvedValue(registrations),
  loadRegisteredEvents = vi.fn().mockResolvedValue([registeredEvent]),
}: {
  loadRegistrations?: (contactId: string, signal?: AbortSignal) => Promise<readonly EventRegistration[]>
  loadRegisteredEvents?: (eventIds: readonly string[], signal?: AbortSignal) => Promise<readonly EventItem[]>
} = {}) {
  return render(
    <MemoryRouter>
      <MyCalendar
        contactId={contactId}
        initialMonth={new Date(2026, 8, 1)}
        acceptedItems={[]}
        loadRegistrations={loadRegistrations}
        loadRegisteredEvents={loadRegisteredEvents}
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

  test('aborts the active registration request when My Calendar unmounts', () => {
    let requestSignal: AbortSignal | undefined
    const loadRegistrations = vi.fn((_contactId: string, signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<readonly EventRegistration[]>(() => undefined)
    })
    const view = renderCalendar({ loadRegistrations })

    expect(requestSignal?.aborted).toBe(false)
    view.unmount()
    expect(requestSignal?.aborted).toBe(true)
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

  test('shows an empty registered-event state when the Contact has no Registered rows', async () => {
    const loadRegisteredEvents = vi.fn()
    renderCalendar({
      loadRegistrations: vi.fn().mockResolvedValue([
        { ...registrations[1], status: EVENT_REGISTRATION_STATUS.waitlisted },
      ]),
      loadRegisteredEvents,
    })

    expect(await screen.findByRole('heading', { name: 'No registered events yet' })).toBeInTheDocument()
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
})
