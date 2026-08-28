import { useEffect, useMemo, useState } from 'react'
import { LuCalendarDays, LuChevronLeft, LuList, LuMapPin } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import MonthCalendar from '../components/MonthCalendar'
import {
  eventDateLabel,
  eventItems,
  type EventCategory,
  type EventItem,
} from '../data/eventsData'

type EventsProps = { items?: readonly EventItem[] }
type EventsView = 'list' | 'calendar'
type EventsFilter = EventCategory | 'All'
type EventCalendarItem = EventItem & { kind: 'event' }

const filters: readonly EventsFilter[] = ['All', 'Convention', 'Rally', 'Advocacy Day', 'Briefing']
const initialCalendarMonth = new Date(2026, 8, 1)

function slugClass(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function EventCard({ item }: { item: EventItem }) {
  return (
    <article className="oiac-event-card">
      <div className="oiac-event-card__topline">
        <span className={`oiac-event-card__category oiac-event-card__category--${slugClass(item.category)}`}>
          {item.category}
        </span>
        <span className={`oiac-event-card__status oiac-event-card__status--${slugClass(item.status)}`}>
          {item.status}
        </span>
      </div>

      <h3>{item.title}</h3>

      <div className="oiac-event-card__details">
        <span>
          <LuCalendarDays aria-hidden="true" />
          <time dateTime={item.date}>{eventDateLabel(item.date)}</time>
        </span>
        <span>
          <LuMapPin aria-hidden="true" />
          {item.location}
        </span>
      </div>

      {item.status !== 'Completed' ? (
        <div className="oiac-event-card__actions">
          <button type="button">{item.registered ? '✓ Registered' : 'Register'}</button>
          <button type="button">Add to Calendar</button>
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

export default function Events({ items = eventItems }: EventsProps) {
  const [activeFilter, setActiveFilter] = useState<EventsFilter>('All')
  const [activeView, setActiveView] = useState<EventsView>('list')
  const filteredItems = useMemo(
    () => activeFilter === 'All' ? items : items.filter((item) => item.category === activeFilter),
    [activeFilter, items],
  )
  const calendarItems = useMemo<readonly EventCalendarItem[]>(
    () => filteredItems.map((item) => ({ ...item, kind: 'event' })),
    [filteredItems],
  )

  useEffect(() => {
    document.title = 'Events — OIAC Engage'
  }, [])

  return (
    <div className="page oiac-events-page">
      <Link className="oiac-events-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="oiac-events-page__header">
        <h1>Events</h1>
        <p>Rallies, conventions, advocacy days, and organizational briefings.</p>
      </header>

      <div className="oiac-events-page__toolbar">
        <div className="oiac-events-page__filters" role="group" aria-label="Filter events by category">
          {filters.map((filter) => (
            <button
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              key={filter}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="oiac-events-page__view-toggle" role="group" aria-label="Event view">
          <button
            type="button"
            aria-pressed={activeView === 'list'}
            onClick={() => setActiveView('list')}
          >
            <LuList aria-hidden="true" />
            <span>List</span>
          </button>
          <button
            type="button"
            aria-pressed={activeView === 'calendar'}
            onClick={() => setActiveView('calendar')}
          >
            <LuCalendarDays aria-hidden="true" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {activeView === 'list' ? (
        filteredItems.length > 0 ? (
          <section className="oiac-events-page__grid" aria-label="Events list">
            {filteredItems.map((item) => <EventCard item={item} key={item.id} />)}
          </section>
        ) : (
          <section className="oiac-events-page__empty" aria-labelledby="events-empty-heading">
            <h2 id="events-empty-heading">{items.length === 0 ? 'No events yet' : 'No events in this category'}</h2>
            <p>{items.length === 0 ? 'New events will appear here when they are scheduled.' : 'Choose another category to see available events.'}</p>
          </section>
        )
      ) : (
        <MonthCalendar
          items={calendarItems}
          initialMonth={initialCalendarMonth}
          ariaLabelPrefix="Events"
          renderItem={renderCalendarEvent}
        />
      )}
    </div>
  )
}
