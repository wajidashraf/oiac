import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import MonthCalendar from '../components/MonthCalendar'
import {
  acceptedMeetingInviteToCalendarItem,
  acceptedMeetingItems,
  eventToCalendarItem,
  itemsForMonth,
  type CalendarItem,
} from '../data/calendarData'
import {
  EVENT_REGISTRATION_STATUS,
  getEventRegistrations,
} from '../features/eventRegistrations/eventRegistrationService'
import type { EventRegistration } from '../features/eventRegistrations/eventRegistrationTypes'
import { getCalendarEvents } from '../features/events/eventService'
import type { EventItem } from '../features/events/eventTypes'
import { getMeetingInvites } from '../features/meetingInvites/meetingInviteService'
import type { MeetingInviteCollection } from '../features/meetingInvites/meetingInviteTypes'
import {
  classifyPowerPagesLoadFailure,
  type PowerPagesLoadFailureKind,
} from '../shared/powerPagesApi'

type MyCalendarProps = {
  readonly contactId?: string
  readonly acceptedItems?: readonly CalendarItem[]
  readonly initialMonth?: Date
  readonly loadRegistrations?: (
    contactId: string,
    signal?: AbortSignal,
  ) => Promise<readonly EventRegistration[]>
  readonly loadRegisteredEvents?: (
    eventIds: readonly string[],
    signal?: AbortSignal,
  ) => Promise<readonly EventItem[]>
  readonly loadMeetingInvites?: (
    contactId: string,
    signal?: AbortSignal,
  ) => Promise<MeetingInviteCollection>
}

const defaultMonth = new Date()

function dateParts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return {
    day,
    month: new Intl.DateTimeFormat('en-US', { month: 'short' })
      .format(new Date(year, month - 1, day))
      .toUpperCase(),
  }
}

function joinLabel(item: CalendarItem): string {
  return `Join ${item.title} (opens in a new tab)`
}

function renderCalendarItem(item: CalendarItem): ReactNode {
  const className = `oiac-calendar__item oiac-calendar__item--${item.kind}`
  if (!item.joinUrl) return <span className={className} title={item.title}>{item.title}</span>
  return (
    <a
      className={className}
      href={item.joinUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={joinLabel(item)}
      title={item.title}
    >
      {item.title}
    </a>
  )
}

function upcomingItemContents(item: CalendarItem): ReactNode {
  const date = dateParts(item.date)
  return (
    <>
      <time className={`oiac-calendar-upcoming__date oiac-calendar-upcoming__date--${item.kind}`} dateTime={item.date}>
        <strong>{date.day}</strong>
        <span>{date.month}</span>
      </time>
      <span className="oiac-calendar-upcoming__details">
        <strong>{item.title}</strong>
        <span>{item.time} · {item.location}</span>
      </span>
      <span className={`oiac-calendar-upcoming__status oiac-calendar-upcoming__status--${item.kind}`}>
        {item.status}
      </span>
    </>
  )
}

export default function MyCalendar({
  contactId,
  acceptedItems = acceptedMeetingItems,
  initialMonth = defaultMonth,
  loadRegistrations = getEventRegistrations,
  loadRegisteredEvents = getCalendarEvents,
  loadMeetingInvites = getMeetingInvites,
}: MyCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const [registeredItems, setRegisteredItems] = useState<readonly CalendarItem[]>([])
  const [meetingItems, setMeetingItems] = useState<readonly CalendarItem[]>([])
  const [eventsStatus, setEventsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [meetingsStatus, setMeetingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [eventsFailureKind, setEventsFailureKind] = useState<PowerPagesLoadFailureKind | null>(null)
  const [meetingsFailureKind, setMeetingsFailureKind] = useState<PowerPagesLoadFailureKind | null>(null)
  const [requestNumber, setRequestNumber] = useState(0)
  const year = selectedMonth.getFullYear()
  const monthIndex = selectedMonth.getMonth()
  const items = useMemo(
    () => [...acceptedItems, ...registeredItems, ...meetingItems],
    [acceptedItems, meetingItems, registeredItems],
  )
  const visibleItems = useMemo(() => itemsForMonth(items, year, monthIndex), [items, monthIndex, year])
  const isLoading = eventsStatus === 'loading' || meetingsStatus === 'loading'
  const bothFailed = eventsStatus === 'error' && meetingsStatus === 'error'
  const isEmpty = eventsStatus === 'ready'
    && meetingsStatus === 'ready'
    && items.length === 0

  useEffect(() => {
    document.title = 'My Calendar — OIAC Engage'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setRegisteredItems([])
    setMeetingItems([])
    setEventsStatus('loading')
    setMeetingsStatus('loading')
    setEventsFailureKind(null)
    setMeetingsFailureKind(null)

    if (!contactId) {
      setEventsFailureKind('processing')
      setMeetingsFailureKind('processing')
      setEventsStatus('error')
      setMeetingsStatus('error')
      return () => controller.abort()
    }

    const load = async () => {
      const meetingInvitesPromise = loadMeetingInvites(contactId, controller.signal)
        .then((meetingCollection) => meetingCollection.invites.flatMap((invite) => {
          const item = acceptedMeetingInviteToCalendarItem(invite)
          return item ? [item] : []
        }))
      const registeredEventsPromise = loadRegistrations(contactId, controller.signal)
        .then(async (registrations) => {
          const registeredIds = Array.from(new Set(
            registrations
              .filter((registration) => registration.status === EVENT_REGISTRATION_STATUS.registered)
              .map((registration) => registration.eventId),
          ))
          const events = registeredIds.length > 0
            ? loadRegisteredEvents(registeredIds, controller.signal)
            : []
          return (await events).flatMap((event) => {
            const item = eventToCalendarItem(event)
            return item ? [item] : []
          })
        })
      const [eventsResult, meetingsResult] = await Promise.allSettled([
        registeredEventsPromise,
        meetingInvitesPromise,
      ])
      if (controller.signal.aborted) return

      if (eventsResult.status === 'fulfilled') {
        setRegisteredItems(eventsResult.value)
        setEventsFailureKind(null)
        setEventsStatus('ready')
      } else {
        setRegisteredItems([])
        setEventsFailureKind(classifyPowerPagesLoadFailure(eventsResult.reason))
        setEventsStatus('error')
      }

      if (meetingsResult.status === 'fulfilled') {
        setMeetingItems(meetingsResult.value)
        setMeetingsFailureKind(null)
        setMeetingsStatus('ready')
      } else {
        setMeetingItems([])
        setMeetingsFailureKind(classifyPowerPagesLoadFailure(meetingsResult.reason))
        setMeetingsStatus('error')
      }
    }

    void load()

    return () => controller.abort()
  }, [acceptedItems, contactId, loadMeetingInvites, loadRegisteredEvents, loadRegistrations, requestNumber])

  const retry = () => setRequestNumber((value) => value + 1)

  return (
    <div className="page oiac-calendar-page">
      <Link className="oiac-calendar-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="oiac-calendar-page__header">
        <h1>My Calendar</h1>
        <p>Meetings you have accepted and events you are registered for.</p>
      </header>

      <ul className="oiac-calendar-page__legend" aria-label="Calendar item types">
        <li><span className="oiac-calendar-page__legend-key oiac-calendar-page__legend-key--meeting" aria-hidden="true" />Accepted meetings</li>
        <li><span className="oiac-calendar-page__legend-key oiac-calendar-page__legend-key--event" aria-hidden="true" />Registered events</li>
      </ul>

      {isLoading ? (
        <section className="oiac-calendar-page__state" role="status" aria-live="polite">
          <h2>Loading your calendar…</h2>
          <p>Your registered events and accepted meetings are being retrieved.</p>
        </section>
      ) : bothFailed ? (
        <section className="oiac-calendar-page__state oiac-calendar-page__state--error" role="alert">
          <h2>Your calendar could not be loaded</h2>
          <p>
            {eventsFailureKind === 'processing' || meetingsFailureKind === 'processing'
              ? 'Some calendar data was returned but could not be processed. Please try again.'
              : 'Please try again. If the problem continues, contact an administrator.'}
          </p>
          <button type="button" onClick={retry}>Try again</button>
        </section>
      ) : isEmpty ? (
        <section className="oiac-calendar-page__state">
          <h2>No registered events or accepted meetings yet</h2>
          <p>Register for an event or accept a meeting invitation to add it here.</p>
          <Link to="/activity/events">Browse events</Link>
        </section>
      ) : (
        <>
          {eventsStatus === 'error' ? (
            <section className="form-alert oiac-calendar-page__partial-error" role="alert">
              <p>
                {eventsFailureKind === 'processing'
                  ? 'Some saved event registration data could not be processed.'
                  : 'Registered events could not be loaded. Accepted meetings are still shown.'}
              </p>
              <button type="button" onClick={retry}>Try loading all calendar data again</button>
            </section>
          ) : null}
          {meetingsStatus === 'error' ? (
            <section className="form-alert oiac-calendar-page__partial-error" role="alert">
              <p>
                {meetingsFailureKind === 'processing'
                  ? 'Some accepted meeting data could not be processed.'
                  : 'Accepted meetings could not be loaded. Registered events are still shown.'}
              </p>
              <button type="button" onClick={retry}>Try loading all calendar data again</button>
            </section>
          ) : null}
          <MonthCalendar
            items={items}
            initialMonth={initialMonth}
            ariaLabelPrefix=""
            onMonthChange={setSelectedMonth}
            renderItem={renderCalendarItem}
          />

          <section className="oiac-calendar-upcoming" aria-labelledby="calendar-upcoming-heading">
            <h2 id="calendar-upcoming-heading">Upcoming</h2>
            {visibleItems.length > 0 ? (
              <ol className="oiac-calendar-upcoming__list">
                {visibleItems.map((item) => (
                  <li key={item.id}>
                    {item.joinUrl ? (
                      <a
                        className="oiac-calendar-upcoming__item"
                        href={item.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={joinLabel(item)}
                      >
                        {upcomingItemContents(item)}
                      </a>
                    ) : (
                      <div className="oiac-calendar-upcoming__item">
                        {upcomingItemContents(item)}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="oiac-calendar-upcoming__empty" role="status">
                <h3>No upcoming items this month</h3>
                <p>Use the calendar arrows to check another month.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
