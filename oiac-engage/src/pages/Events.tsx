import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuCalendarDays, LuChevronLeft, LuList, LuMapPin } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import MonthCalendar from '../components/MonthCalendar'
import { eventCalendarDate, eventDateLabel, eventLocationLabel } from '../data/eventsData'
import {
  EVENT_REGISTRATION_STATUS,
  getEventRegistrations,
  registerForEvent,
} from '../features/eventRegistrations/eventRegistrationService'
import type {
  EventRegistration,
  RegistrationOutcome,
} from '../features/eventRegistrations/eventRegistrationTypes'
import EventForm from '../features/events/EventForm'
import { createEvent, getEvents, updateEvent } from '../features/events/eventService'
import type { EventMutationResult } from '../features/events/eventService'
import type { EventInput, EventItem } from '../features/events/eventTypes'

type EventsProps = {
  readonly isAdmin: boolean
  readonly contactId?: string
  readonly loadEvents?: (isAdmin: boolean, signal?: AbortSignal) => Promise<readonly EventItem[]>
  readonly loadRegistrations?: (contactId: string) => Promise<readonly EventRegistration[]>
  readonly registerEvent?: (contactId: string, eventId: string) => Promise<RegistrationOutcome>
  readonly createEventRecord?: (input: EventInput) => Promise<EventMutationResult>
  readonly updateEventRecord?: (id: string, input: EventInput) => Promise<EventMutationResult>
}
type EventsView = 'list' | 'calendar'
type EventCalendarItem = EventItem & { readonly kind: 'event'; readonly date: `${number}-${number}-${number}` }
type ActiveEventForm = { readonly mode: 'create' } | { readonly mode: 'edit'; readonly event: EventItem }

function slugClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function initialCalendarMonth(items: readonly EventItem[]): Date {
  const now = Date.now()
  const future = items
    .flatMap((item) => item.startDateTime ? [new Date(item.startDateTime)] : [])
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= now)
    .sort((first, second) => first.getTime() - second.getTime())
  const valid = items
    .flatMap((item) => item.startDateTime ? [new Date(item.startDateTime)] : [])
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime())
  const selected = future[0] ?? valid[0] ?? new Date()
  return new Date(selected.getFullYear(), selected.getMonth(), 1)
}

function EventCard({
  item,
  isAdmin,
  mutationPending,
  registrationStatus,
  registrationPending,
  pendingAction,
  registrationAvailable,
  onRegister,
  onEdit,
}: {
  readonly item: EventItem
  readonly isAdmin: boolean
  readonly mutationPending: boolean
  readonly registrationStatus?: EventRegistration['status']
  readonly registrationPending: boolean
  readonly pendingAction?: 'register' | 'calendar'
  readonly registrationAvailable: boolean
  readonly onRegister: (item: EventItem, action: 'register' | 'calendar') => void
  readonly onEdit: (item: EventItem, trigger: HTMLButtonElement) => void
}) {
  const isPublished = item.eventStatusValue === 866530001
  const isRegistrationOpen = item.eventStatusValue === 866530002
  const isPublicEvent = isPublished || isRegistrationOpen
  const isRegistered = registrationStatus === EVENT_REGISTRATION_STATUS.registered
  const isWaitlisted = registrationStatus === EVENT_REGISTRATION_STATUS.waitlisted
  const registrationDisabled = !registrationAvailable || registrationPending || isRegistered || isWaitlisted
  const registerLabel = isRegistered
    ? 'Registered'
    : isWaitlisted
      ? 'Waitlisted'
      : registrationPending && pendingAction === 'register'
        ? 'Registering…'
        : 'Register'
  const calendarLabel = isRegistered
    ? 'In My Calendar'
    : isWaitlisted
      ? 'Add to Calendar (Waitlisted)'
      : registrationPending && pendingAction === 'calendar'
        ? 'Adding to My Calendar…'
        : 'Add to Calendar'

  return (
    <article className="oiac-event-card">
      <div className="oiac-event-card__topline">
        <span className={`oiac-event-card__category oiac-event-card__category--${slugClass(item.eventType)}`}>
          {item.eventType}
        </span>
        <span className={`oiac-event-card__status oiac-event-card__status--${slugClass(item.eventStatus)}`}>
          {item.eventStatus}
        </span>
      </div>

      <h3>{item.title}</h3>

      <div className="oiac-event-card__details">
        <span>
          <LuCalendarDays aria-hidden="true" />
          <time dateTime={item.startDateTime ?? undefined}>{eventDateLabel(item.startDateTime, item.endDateTime)}</time>
        </span>
        <span>
          <LuMapPin aria-hidden="true" />
          {eventLocationLabel(item.eventFormat, item.venueName, item.meetingUrl)}
        </span>
      </div>

      {isPublicEvent || isAdmin ? (
        <div className="oiac-event-card__actions">
          {isRegistrationOpen ? (
            <button
              type="button"
              disabled={registrationDisabled}
              onClick={() => onRegister(item, 'register')}
            >
              {registerLabel}
            </button>
          ) : null}
          {isPublicEvent ? (
            <button
              type="button"
              disabled={registrationDisabled}
              onClick={() => onRegister(item, 'calendar')}
            >
              {calendarLabel}
            </button>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={mutationPending}
              onClick={(clickEvent) => onEdit(item, clickEvent.currentTarget)}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function renderCalendarEvent(item: EventCalendarItem) {
  return (
    <span className="oiac-calendar__item oiac-calendar__item--event oiac-events-calendar__item" title={item.title}>
      {item.title}
    </span>
  )
}

export default function Events({
  isAdmin,
  contactId,
  loadEvents = getEvents,
  loadRegistrations = getEventRegistrations,
  registerEvent = registerForEvent,
  createEventRecord = createEvent,
  updateEventRecord = updateEvent,
}: EventsProps) {
  const [items, setItems] = useState<readonly EventItem[]>([])
  const [activeStatus, setActiveStatus] = useState('All')
  const [activeView, setActiveView] = useState<EventsView>('list')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [requestNumber, setRequestNumber] = useState(0)
  const [activeForm, setActiveForm] = useState<ActiveEventForm | null>(null)
  const [mutationPending, setMutationPending] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<readonly EventRegistration[]>([])
  const [registrationLoadState, setRegistrationLoadState] = useState<'loading' | 'ready' | 'error'>(
    contactId ? 'loading' : 'error',
  )
  const [pendingRegistrationActions, setPendingRegistrationActions] = useState<Readonly<Record<string, 'register' | 'calendar'>>>({})
  const [registrationNotice, setRegistrationNotice] = useState<{ readonly type: 'success' | 'error'; readonly text: string } | null>(null)
  const pendingRegistrationIds = useRef(new Set<string>())
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const formTriggerRef = useRef<HTMLButtonElement | null>(null)

  const reload = useCallback(() => setRequestNumber((value) => value + 1), [])

  const openCreateForm = (trigger: HTMLButtonElement) => {
    if (mutationPending) return
    formTriggerRef.current = trigger
    setMutationError(null)
    setActiveForm({ mode: 'create' })
  }

  const openEditForm = (event: EventItem, trigger: HTMLButtonElement) => {
    if (mutationPending) return
    formTriggerRef.current = trigger
    setMutationError(null)
    setActiveForm({ mode: 'edit', event })
  }

  const closeForm = () => {
    setActiveForm(null)
    setMutationError(null)
    formTriggerRef.current?.focus()
  }

  const saveActiveEvent = async (input: EventInput) => {
    if (!isAdmin || !activeForm || mutationPending) return
    setMutationPending(true)
    setMutationError(null)
    try {
      if (activeForm.mode === 'create') {
        await createEventRecord(input)
      } else {
        await updateEventRecord(activeForm.event.id, input)
      }
      setActiveForm(null)
      reload()
    } catch {
      setMutationError('Event could not be saved. Please try again.')
    } finally {
      setMutationPending(false)
    }
  }

  useEffect(() => {
    document.title = 'Events — OIAC Engage'
  }, [])

  useEffect(() => {
    let active = true
    setRegistrations([])
    setRegistrationNotice(null)
    if (!contactId) {
      setRegistrationLoadState('error')
      return () => { active = false }
    }

    setRegistrationLoadState('loading')
    loadRegistrations(contactId)
      .then((loadedRegistrations) => {
        if (!active) return
        setRegistrations(loadedRegistrations)
        setRegistrationLoadState('ready')
      })
      .catch(() => {
        if (!active) return
        setRegistrationLoadState('error')
      })

    return () => { active = false }
  }, [contactId, loadRegistrations])

  useEffect(() => {
    const controller = new AbortController()
    setLoadState('loading')
    setActiveStatus('All')

    loadEvents(isAdmin, controller.signal)
      .then((loadedItems) => {
        if (controller.signal.aborted) return
        setItems(loadedItems)
        setLoadState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setItems([])
        setLoadState('error')
      })

    return () => controller.abort()
  }, [isAdmin, loadEvents, requestNumber])

  const statuses = useMemo(
    () => ['All', ...Array.from(new Set(items.map((item) => item.eventStatus)))],
    [items],
  )
  const filteredItems = useMemo(
    () => activeStatus === 'All' ? items : items.filter((item) => item.eventStatus === activeStatus),
    [activeStatus, items],
  )
  const calendarItems = useMemo<readonly EventCalendarItem[]>(
    () => filteredItems.flatMap((item) => {
      const date = eventCalendarDate(item.startDateTime)
      return date ? [{ ...item, date, kind: 'event' as const }] : []
    }),
    [filteredItems],
  )
  const calendarMonth = useMemo(() => initialCalendarMonth(filteredItems.length > 0 ? filteredItems : items), [filteredItems, items])
  const registrationByEventId = useMemo(() => {
    const result = new Map<string, EventRegistration>()
    const priority = new Map([
      [EVENT_REGISTRATION_STATUS.registered, 3],
      [EVENT_REGISTRATION_STATUS.waitlisted, 2],
      [EVENT_REGISTRATION_STATUS.cancelled, 1],
    ])
    registrations.forEach((registration) => {
      const existing = result.get(registration.eventId)
      if (!existing || (priority.get(registration.status) ?? 0) > (priority.get(existing.status) ?? 0)) {
        result.set(registration.eventId, registration)
      }
    })
    return result
  }, [registrations])

  const registerSelectedEvent = async (item: EventItem, action: 'register' | 'calendar') => {
    if (!contactId || registrationLoadState !== 'ready' || pendingRegistrationIds.current.has(item.id)) return
    pendingRegistrationIds.current.add(item.id)
    setRegistrationNotice(null)
    setPendingRegistrationActions((current) => ({ ...current, [item.id]: action }))

    try {
      const result = await registerEvent(contactId, item.id)
      setRegistrations((current) => [
        ...current.filter((registration) => registration.eventId !== item.id),
        result.registration,
      ])
      if (result.outcome === 'waitlisted') {
        setRegistrationNotice({ type: 'success', text: `${item.title} remains on the waitlist.` })
      } else {
        setRegistrationNotice({
          type: 'success',
          text: action === 'calendar'
            ? `${item.title} was added to My Calendar.`
            : `You are registered for ${item.title}.`,
        })
      }
    } catch {
      setRegistrationNotice({
        type: 'error',
        text: 'Registration could not be completed. Please try again.',
      })
    } finally {
      pendingRegistrationIds.current.delete(item.id)
      setPendingRegistrationActions((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
  }

  return (
    <div className="page oiac-events-page">
      <Link className="oiac-events-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="oiac-events-page__header">
        <div>
          <h1>Events</h1>
          <p>Upcoming rallies, meetings, webinars, trainings, and community events.</p>
        </div>
        {isAdmin ? (
          <button
            ref={createButtonRef}
            className="oiac-events-page__create"
            type="button"
            aria-expanded={activeForm?.mode === 'create'}
            aria-controls="event-management-form"
            disabled={mutationPending}
            onClick={(clickEvent) => openCreateForm(clickEvent.currentTarget)}
          >
            + Create Event
          </button>
        ) : null}
      </header>

      {registrationNotice ? (
        <p
          className={`oiac-events-page__notice oiac-events-page__notice--${registrationNotice.type}`}
          role={registrationNotice.type === 'error' ? 'alert' : 'status'}
        >
          {registrationNotice.text}
        </p>
      ) : registrationLoadState === 'error' && contactId ? (
        <p className="oiac-events-page__notice oiac-events-page__notice--error" role="alert">
          Your event registrations could not be loaded. Refresh the page and try again.
        </p>
      ) : null}

      {isAdmin && activeForm ? (
        <div id="event-management-form">
          <EventForm
            key={activeForm.mode === 'create' ? 'create' : activeForm.event.id}
            mode={activeForm.mode}
            event={activeForm.mode === 'edit' ? activeForm.event : undefined}
            pending={mutationPending}
            requestError={mutationError}
            onSave={saveActiveEvent}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      <div className="oiac-events-page__toolbar">
        {isAdmin && loadState === 'ready' ? (
          <div className="oiac-events-page__filters" role="group" aria-label="Filter events by status">
            {statuses.map((status) => (
              <button
                type="button"
                aria-pressed={activeStatus === status}
                onClick={() => setActiveStatus(status)}
                key={status}
              >
                {status}
              </button>
            ))}
          </div>
        ) : <span />}

        <div className="oiac-events-page__view-toggle" role="group" aria-label="Event view">
          <button type="button" aria-pressed={activeView === 'list'} onClick={() => setActiveView('list')}>
            <LuList aria-hidden="true" />
            <span>List</span>
          </button>
          <button type="button" aria-pressed={activeView === 'calendar'} onClick={() => setActiveView('calendar')}>
            <LuCalendarDays aria-hidden="true" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {loadState === 'loading' ? (
        <section className="oiac-events-page__empty" role="status" aria-live="polite">
          <h2>Loading events…</h2>
          <p>The latest event schedule is being retrieved.</p>
        </section>
      ) : loadState === 'error' ? (
        <section className="oiac-events-page__empty oiac-events-page__empty--error">
          <h2>Events could not be loaded</h2>
          <p>Please try again. If the problem continues, contact an administrator.</p>
          <button type="button" onClick={reload}>Try again</button>
        </section>
      ) : activeView === 'list' ? (
        filteredItems.length > 0 ? (
          <section className="oiac-events-page__grid" aria-label="Events list">
            {filteredItems.map((item) => (
              <EventCard
                item={item}
                isAdmin={isAdmin}
                mutationPending={mutationPending}
                registrationStatus={registrationByEventId.get(item.id)?.status}
                registrationPending={Boolean(pendingRegistrationActions[item.id])}
                pendingAction={pendingRegistrationActions[item.id]}
                registrationAvailable={registrationLoadState === 'ready'}
                onRegister={registerSelectedEvent}
                onEdit={openEditForm}
                key={item.id}
              />
            ))}
          </section>
        ) : (
          <section className="oiac-events-page__empty">
            <h2>{items.length === 0 ? 'No events available' : 'No events with this status'}</h2>
            <p>{items.length === 0 ? 'New events will appear here when they are scheduled.' : 'Choose another Event Status to see matching records.'}</p>
          </section>
        )
      ) : (
        <MonthCalendar
          key={`${activeStatus}-${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`}
          items={calendarItems}
          initialMonth={calendarMonth}
          ariaLabelPrefix="Events"
          renderItem={renderCalendarEvent}
        />
      )}
    </div>
  )
}
