import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import MonthCalendar from '../components/MonthCalendar'
import {
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
}: MyCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const [items, setItems] = useState<readonly CalendarItem[]>(acceptedItems)
  const [registeredEventCount, setRegisteredEventCount] = useState(0)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [requestNumber, setRequestNumber] = useState(0)
  const year = selectedMonth.getFullYear()
  const monthIndex = selectedMonth.getMonth()
  const visibleItems = useMemo(() => itemsForMonth(items, year, monthIndex), [items, monthIndex, year])

  useEffect(() => {
    document.title = 'My Calendar — OIAC Engage'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setItems(acceptedItems)
    setRegisteredEventCount(0)
    setLoadState('loading')

    if (!contactId) {
      setLoadState('error')
      return () => controller.abort()
    }

    const load = async () => {
      const registrations = await loadRegistrations(contactId, controller.signal)
      const registeredIds = Array.from(new Set(
        registrations
          .filter((registration) => registration.status === EVENT_REGISTRATION_STATUS.registered)
          .map((registration) => registration.eventId),
      ))
      const events = registeredIds.length > 0
        ? await loadRegisteredEvents(registeredIds, controller.signal)
        : []
      const registeredItems = events.flatMap((event) => {
        const item = eventToCalendarItem(event)
        return item ? [item] : []
      })
      if (controller.signal.aborted) return
      setItems([...acceptedItems, ...registeredItems])
      setRegisteredEventCount(registeredItems.length)
      setLoadState('ready')
    }

    load().catch(() => {
      if (controller.signal.aborted) return
      setItems(acceptedItems)
      setRegisteredEventCount(0)
      setLoadState('error')
    })

    return () => controller.abort()
  }, [acceptedItems, contactId, loadRegisteredEvents, loadRegistrations, requestNumber])

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

      {loadState === 'loading' ? (
        <section className="oiac-calendar-page__state" role="status" aria-live="polite">
          <h2>Loading your calendar…</h2>
          <p>Your registered events are being retrieved.</p>
        </section>
      ) : loadState === 'error' ? (
        <section className="oiac-calendar-page__state oiac-calendar-page__state--error" role="alert">
          <h2>Your calendar could not be loaded</h2>
          <p>Please try again. If the problem continues, contact an administrator.</p>
          <button type="button" onClick={retry}>Try again</button>
        </section>
      ) : registeredEventCount === 0 && acceptedItems.length === 0 ? (
        <section className="oiac-calendar-page__state">
          <h2>No registered events yet</h2>
          <p>Choose Add to Calendar on an open event to register and add it here.</p>
          <Link to="/activity/events">Browse events</Link>
        </section>
      ) : (
        <>
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
