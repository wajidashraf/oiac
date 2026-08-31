import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { EVENT_REGISTRATION_STATUS } from '../features/eventRegistrations/eventRegistrationService'
import type {
  EventRegistration,
  RegistrationOutcome,
} from '../features/eventRegistrations/eventRegistrationTypes'
import type { EventInput, EventItem } from '../features/events/eventTypes'
import Events from './Events'

const contactId = '11111111-1111-4111-8111-111111111111'
const registrationId = '33333333-3333-4333-8333-333333333333'

const volunteerEvents: readonly EventItem[] = [
  {
    id: 'open-event',
    title: 'Volunteer Orientation Webinar',
    eventFormat: 'Virtual',
    eventFormatValue: 866530001,
    eventStatus: 'Registration Open',
    eventStatusValue: 866530002,
    eventType: 'Webinar',
    eventTypeValue: 866530005,
    startDateTime: '2026-09-16T18:00:00Z',
    endDateTime: '2026-09-16T19:30:00Z',
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/orientation',
    venueName: null,
    description: 'Volunteer orientation details.',
  },
  {
    id: 'published-event',
    title: 'Community Engagement Meeting',
    eventFormat: 'In Person',
    eventFormatValue: 866530000,
    eventStatus: 'Published',
    eventStatusValue: 866530001,
    eventType: 'Meeting',
    eventTypeValue: 866530002,
    startDateTime: '2026-09-22T17:30:00Z',
    endDateTime: '2026-09-22T19:00:00Z',
    meetingUrl: null,
    venueName: 'District Office Meeting Room',
    description: 'Community engagement details.',
  },
]

const adminEvents: readonly EventItem[] = [
  ...volunteerEvents,
  {
    id: 'draft-event',
    title: 'Draft Town Hall',
    eventFormat: 'Hybrid',
    eventFormatValue: 866530002,
    eventStatus: 'Draft',
    eventStatusValue: 866530000,
    eventType: 'Town Hall',
    eventTypeValue: 866530007,
    startDateTime: null,
    endDateTime: null,
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/town-hall',
    venueName: 'Community Center',
    description: null,
  },
]

function registrationFor(eventId: string, status: EventRegistration['status']): EventRegistration {
  return {
    id: registrationId,
    contactId,
    eventId,
    registrationDate: '2026-08-30T12:00:00Z',
    registrationNumber: 'REG-1001',
    status,
  }
}

function renderEvents({
  isAdmin = false,
  currentContactId = contactId,
  loadEvents = vi.fn().mockResolvedValue(volunteerEvents),
  loadRegistrations = vi.fn().mockResolvedValue([]),
  registerEvent = vi.fn(),
  createEventRecord = vi.fn(),
  updateEventRecord = vi.fn(),
}: {
  isAdmin?: boolean
  currentContactId?: string
  loadEvents?: (isAdmin: boolean, signal?: AbortSignal) => Promise<readonly EventItem[]>
  loadRegistrations?: (contactId: string) => Promise<readonly EventRegistration[]>
  registerEvent?: (contactId: string, eventId: string) => Promise<RegistrationOutcome>
  createEventRecord?: (input: EventInput) => Promise<{ readonly id: string }>
  updateEventRecord?: (id: string, input: EventInput) => Promise<{ readonly id: string }>
} = {}) {
  return render(
    <MemoryRouter>
      <Events
        isAdmin={isAdmin}
        contactId={currentContactId}
        loadEvents={loadEvents}
        loadRegistrations={loadRegistrations}
        registerEvent={registerEvent}
        createEventRecord={createEventRecord}
        updateEventRecord={updateEventRecord}
      />
    </MemoryRouter>,
  )
}

describe('Events', () => {
  test('loads Dataverse events and shows the event type on each card', async () => {
    const loadEvents = vi.fn().mockResolvedValue(volunteerEvents)
    renderEvents({ loadEvents })

    expect(screen.getByRole('status')).toHaveTextContent('Loading events')
    expect(await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).toBeInTheDocument()
    expect(screen.getByText('Webinar')).toBeInTheDocument()
    expect(screen.getByText('Meeting')).toBeInTheDocument()
    expect(screen.getByText('Online meeting')).toBeInTheDocument()
    expect(screen.getByText('District Office Meeting Room')).toBeInTheDocument()
    expect(loadEvents).toHaveBeenCalledWith(false, expect.any(AbortSignal))
    expect(document.title).toBe('Events — OIAC Engage')
  })

  test('aborts the active Events request when the page unmounts', () => {
    let requestSignal: AbortSignal | undefined
    const loadEvents = vi.fn((_isAdmin: boolean, signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<readonly EventItem[]>(() => undefined)
    })
    const view = renderEvents({ loadEvents })

    expect(requestSignal?.aborted).toBe(false)
    view.unmount()
    expect(requestSignal?.aborted).toBe(true)
  })

  test('does not expose Event Status filters to volunteers', async () => {
    renderEvents()

    await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })
    expect(screen.queryByRole('group', { name: 'Filter events by status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Create Event' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('registers through Add to Calendar and marks the event as part of My Calendar', async () => {
    const user = userEvent.setup()
    const registration = registrationFor('open-event', EVENT_REGISTRATION_STATUS.registered)
    const registerEvent = vi.fn().mockResolvedValue({ outcome: 'registered', registration })
    renderEvents({ registerEvent })

    const openCard = (await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).closest('article')
    const publishedCard = screen.getByRole('heading', { name: 'Community Engagement Meeting' }).closest('article')
    expect(openCard).not.toBeNull()
    expect(publishedCard).not.toBeNull()

    expect(within(openCard as HTMLElement).getByRole('button', { name: 'Register' })).toBeInTheDocument()
    expect(within(openCard as HTMLElement).getByRole('button', { name: 'Add to Calendar' })).toBeInTheDocument()
    expect(within(publishedCard as HTMLElement).queryByRole('button', { name: 'Register' })).not.toBeInTheDocument()

    await user.click(within(openCard as HTMLElement).getByRole('button', { name: 'Add to Calendar' }))
    await waitFor(() => expect(registerEvent).toHaveBeenCalledWith(contactId, 'open-event'))
    expect(within(openCard as HTMLElement).getByRole('button', { name: 'Registered' })).toBeDisabled()
    expect(within(openCard as HTMLElement).getByRole('button', { name: 'In My Calendar' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Volunteer Orientation Webinar was added to My Calendar.')
  })

  test('loads current registration states and disables actions for Registered and Waitlisted events', async () => {
    const loadRegistrations = vi.fn().mockResolvedValue([
      registrationFor('open-event', EVENT_REGISTRATION_STATUS.waitlisted),
      registrationFor('published-event', EVENT_REGISTRATION_STATUS.registered),
    ])
    renderEvents({ loadRegistrations })

    const openCard = (await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).closest('article')
    const publishedCard = screen.getByRole('heading', { name: 'Community Engagement Meeting' }).closest('article')
    expect(openCard).not.toBeNull()
    expect(publishedCard).not.toBeNull()

    expect(within(openCard as HTMLElement).getByRole('button', { name: 'Waitlisted' })).toBeDisabled()
    expect(within(openCard as HTMLElement).getByRole('button', { name: 'Add to Calendar (Waitlisted)' })).toBeDisabled()
    expect(within(publishedCard as HTMLElement).getByRole('button', { name: 'In My Calendar' })).toBeDisabled()
    expect(loadRegistrations).toHaveBeenCalledWith(contactId)
  })

  test('reactivates a Cancelled registration instead of creating a second row', async () => {
    const user = userEvent.setup()
    const cancelled = registrationFor('open-event', EVENT_REGISTRATION_STATUS.cancelled)
    const reactivated = { ...cancelled, status: EVENT_REGISTRATION_STATUS.registered }
    const registerEvent = vi.fn().mockResolvedValue({ outcome: 'registered', registration: reactivated })
    renderEvents({
      loadRegistrations: vi.fn().mockResolvedValue([cancelled]),
      registerEvent,
    })

    const card = (await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).closest('article')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(registerEvent).toHaveBeenCalledWith(contactId, 'open-event'))
    expect(within(card as HTMLElement).getByRole('button', { name: 'Registered' })).toBeDisabled()
  })

  test('uses one in-flight registration operation for both event actions', async () => {
    const user = userEvent.setup()
    let finishRegistration: ((result: RegistrationOutcome) => void) | undefined
    const registration = registrationFor('open-event', EVENT_REGISTRATION_STATUS.registered)
    const registerEvent = vi.fn(() => new Promise<RegistrationOutcome>((resolve) => {
      finishRegistration = resolve
    }))
    renderEvents({ registerEvent })

    const card = (await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).closest('article')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Register' }))

    expect(within(card as HTMLElement).getByRole('button', { name: 'Registering…' })).toBeDisabled()
    expect(within(card as HTMLElement).getByRole('button', { name: 'Add to Calendar' })).toBeDisabled()
    expect(registerEvent).toHaveBeenCalledTimes(1)

    finishRegistration?.({ outcome: 'registered', registration })
    await waitFor(() => expect(within(card as HTMLElement).getByRole('button', { name: 'Registered' })).toBeDisabled())
  })

  test('shows a retryable registration error without hiding events', async () => {
    const user = userEvent.setup()
    const registerEvent = vi.fn().mockRejectedValue(new Error('Dataverse failed'))
    renderEvents({ registerEvent })

    const card = (await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).closest('article')
    expect(card).not.toBeNull()
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Register' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Registration could not be completed. Please try again.')
    expect(within(card as HTMLElement).getByRole('button', { name: 'Register' })).toBeEnabled()
  })

  test('lets administrators filter all events by Event Status', async () => {
    const user = userEvent.setup()
    const loadEvents = vi.fn().mockResolvedValue(adminEvents)
    renderEvents({ isAdmin: true, loadEvents })

    expect(await screen.findByRole('button', { name: 'All', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registration Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Published' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument()
    expect(loadEvents).toHaveBeenCalledWith(true, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: 'Draft' }))

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Draft Town Hall' })).toBeInTheDocument()
    expect(screen.getByText('Date to be announced')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Volunteer Orientation Webinar' })).not.toBeInTheDocument()
  })

  test('uses loaded records in Calendar view', async () => {
    const user = userEvent.setup()
    renderEvents()

    await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    const grid = screen.getByRole('grid', { name: 'Events September 2026 calendar' })
    expect(within(grid).getByText('Volunteer Orientation Webinar')).toBeInTheDocument()
    expect(within(grid).getByText('Community Engagement Meeting')).toBeInTheDocument()
  })

  test('uses the same administrator status filter in List and Calendar views', async () => {
    const user = userEvent.setup()
    renderEvents({ isAdmin: true, loadEvents: vi.fn().mockResolvedValue(adminEvents) })

    await screen.findByRole('heading', { name: 'Draft Town Hall' })
    await user.click(screen.getByRole('button', { name: 'Published' }))
    expect(screen.getByRole('heading', { name: 'Community Engagement Meeting' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Volunteer Orientation Webinar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    const grid = screen.getByRole('grid', { name: 'Events September 2026 calendar' })
    expect(within(grid).getByText('Community Engagement Meeting')).toBeInTheDocument()
    expect(within(grid).queryByText('Volunteer Orientation Webinar')).not.toBeInTheDocument()
  })

  test('lets administrators open and cancel the inline create form', async () => {
    const user = userEvent.setup()
    renderEvents({ isAdmin: true, loadEvents: vi.fn().mockResolvedValue(adminEvents) })

    await screen.findByRole('heading', { name: 'Draft Town Hall' })
    await user.click(screen.getByRole('button', { name: '+ Create Event' }))

    expect(screen.getByRole('form', { name: 'Create Event' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'Create Event' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Create Event' })).toHaveFocus()
  })

  test('creates an event and reloads the administrator collection', async () => {
    const user = userEvent.setup()
    const loadEvents = vi.fn().mockResolvedValue(adminEvents)
    const createEventRecord = vi.fn().mockResolvedValue({ id: 'created-event-id' })
    renderEvents({ isAdmin: true, loadEvents, createEventRecord })

    await screen.findByRole('heading', { name: 'Draft Town Hall' })
    await user.click(screen.getByRole('button', { name: '+ Create Event' }))
    await user.type(screen.getByLabelText('Event Subject'), 'Volunteer Briefing')
    await user.selectOptions(screen.getByLabelText('Event Type'), '866530010')
    await user.selectOptions(screen.getByLabelText('Event Format'), '866530000')
    await user.type(screen.getByLabelText('Venue Name'), 'OIAC Office')
    await user.type(screen.getByLabelText('Start Date & Time'), '2026-10-01T09:15')
    await user.type(screen.getByLabelText('End Date & Time'), '2026-10-01T10:45')
    await user.click(screen.getByRole('button', { name: 'Create Event' }))

    await waitFor(() => expect(createEventRecord).toHaveBeenCalledTimes(1))
    expect(createEventRecord).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Volunteer Briefing',
      eventTypeValue: 866530010,
      eventFormatValue: 866530000,
      eventStatusValue: 866530000,
      venueName: 'OIAC Office',
      meetingUrl: null,
    }))
    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('form', { name: 'Create Event' })).not.toBeInTheDocument()
  })

  test('edits a selected event and reloads the administrator collection', async () => {
    const user = userEvent.setup()
    const loadEvents = vi.fn().mockResolvedValue(adminEvents)
    const updateEventRecord = vi.fn().mockResolvedValue({ id: 'draft-event' })
    renderEvents({ isAdmin: true, loadEvents, updateEventRecord })

    const draftCard = (await screen.findByRole('heading', { name: 'Draft Town Hall' })).closest('article')
    expect(draftCard).not.toBeNull()
    await user.click(within(draftCard as HTMLElement).getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('form', { name: 'Edit Event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Event Subject')).toHaveValue('Draft Town Hall')
    await user.type(screen.getByLabelText('Start Date & Time'), '2026-10-04T12:00')
    await user.type(screen.getByLabelText('End Date & Time'), '2026-10-04T13:30')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateEventRecord).toHaveBeenCalledWith(
      'draft-event',
      expect.objectContaining({ title: 'Draft Town Hall', eventFormatValue: 866530002 }),
    ))
    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2))
  })

  test('keeps the form open and shows a save error', async () => {
    const user = userEvent.setup()
    const createEventRecord = vi.fn().mockRejectedValue(new Error('Dataverse failed'))
    renderEvents({
      isAdmin: true,
      loadEvents: vi.fn().mockResolvedValue(adminEvents),
      createEventRecord,
    })

    await screen.findByRole('heading', { name: 'Draft Town Hall' })
    await user.click(screen.getByRole('button', { name: '+ Create Event' }))
    await user.type(screen.getByLabelText('Event Subject'), 'Volunteer Briefing')
    await user.selectOptions(screen.getByLabelText('Event Type'), '866530010')
    await user.selectOptions(screen.getByLabelText('Event Format'), '866530000')
    await user.type(screen.getByLabelText('Venue Name'), 'OIAC Office')
    await user.type(screen.getByLabelText('Start Date & Time'), '2026-10-01T09:15')
    await user.type(screen.getByLabelText('End Date & Time'), '2026-10-01T10:45')
    await user.click(screen.getByRole('button', { name: 'Create Event' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Event could not be saved. Please try again.')
    expect(screen.getByRole('form', { name: 'Create Event' })).toBeInTheDocument()
  })

  test('prevents switching event forms while an update is pending', async () => {
    const user = userEvent.setup()
    let finishUpdate: ((result: { readonly id: string }) => void) | undefined
    const updateEventRecord = vi.fn(() => new Promise<{ readonly id: string }>((resolve) => {
      finishUpdate = resolve
    }))
    const loadEvents = vi.fn().mockResolvedValue(adminEvents)
    renderEvents({ isAdmin: true, loadEvents, updateEventRecord })

    const publishedCard = (await screen.findByRole('heading', { name: 'Community Engagement Meeting' })).closest('article')
    expect(publishedCard).not.toBeNull()
    await user.click(within(publishedCard as HTMLElement).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateEventRecord).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('button', { name: '+ Create Event' })).toBeDisabled()
    screen.getAllByRole('button', { name: 'Edit' }).forEach((button) => expect(button).toBeDisabled())
    expect(screen.getByRole('form', { name: 'Edit Event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Event Subject')).toHaveValue('Community Engagement Meeting')

    finishUpdate?.({ id: 'published-event' })
    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2))
  })

  test('omits unscheduled administrator records from Calendar view without crashing', async () => {
    const user = userEvent.setup()
    renderEvents({ isAdmin: true, loadEvents: vi.fn().mockResolvedValue(adminEvents) })

    await screen.findByRole('heading', { name: 'Draft Town Hall' })
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(screen.queryByText('Draft Town Hall')).not.toBeInTheDocument()
    expect(screen.getByText('Volunteer Orientation Webinar')).toBeInTheDocument()
  })

  test('shows a retry action when event loading fails', async () => {
    const user = userEvent.setup()
    const loadEvents = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(volunteerEvents)
    renderEvents({ loadEvents })

    expect(await screen.findByRole('heading', { name: 'Events could not be loaded' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: 'Volunteer Orientation Webinar' })).toBeInTheDocument()
  })
})
