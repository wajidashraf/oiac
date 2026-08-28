import { useEffect, useMemo, useState } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import MonthCalendar from '../components/MonthCalendar'
import {
  calendarItems,
  itemsForMonth,
  type CalendarItem,
} from '../data/calendarData'

type MyCalendarProps = {
  items?: readonly CalendarItem[]
  initialMonth?: Date
}

const defaultMonth = new Date(2026, 8, 1)

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
  return `Join ${item.title} in Microsoft Teams or Outlook (opens in a new tab)`
}

export default function MyCalendar({ items = calendarItems, initialMonth = defaultMonth }: MyCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const year = selectedMonth.getFullYear()
  const monthIndex = selectedMonth.getMonth()
  const visibleItems = useMemo(() => itemsForMonth(items, year, monthIndex), [items, monthIndex, year])

  useEffect(() => {
    document.title = 'My Calendar — OIAC Engage'
  }, [])

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

      <MonthCalendar
        items={items}
        initialMonth={initialMonth}
        ariaLabelPrefix=""
        onMonthChange={setSelectedMonth}
        renderItem={(item) => (
          <a
            className={`oiac-calendar__item oiac-calendar__item--${item.kind}`}
            href={item.joinUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={joinLabel(item)}
            title={item.title}
          >
            {item.title}
          </a>
        )}
      />

      <section className="oiac-calendar-upcoming" aria-labelledby="calendar-upcoming-heading">
        <h2 id="calendar-upcoming-heading">Upcoming</h2>
        {visibleItems.length > 0 ? (
          <ol className="oiac-calendar-upcoming__list">
            {visibleItems.map((item) => {
              const date = dateParts(item.date)
              return (
                <li key={item.id}>
                  <a
                    className="oiac-calendar-upcoming__item"
                    href={item.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={joinLabel(item)}
                  >
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
                  </a>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="oiac-calendar-upcoming__empty" role="status">
            <h3>No upcoming items this month</h3>
            <p>Use the calendar arrows to check another month.</p>
          </div>
        )}
      </section>
    </div>
  )
}
