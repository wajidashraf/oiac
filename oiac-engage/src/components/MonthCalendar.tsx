import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { buildMonthCells, monthLabel, type MonthCell } from '../data/calendarData'

export type MonthCalendarItem = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: string
}

type MonthCalendarProps<T extends MonthCalendarItem> = {
  items: readonly T[]
  initialMonth: Date
  ariaLabelPrefix: string
  renderItem: (item: T) => ReactNode
  onMonthChange?: (month: Date) => void
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function fullDateLabel(year: number, monthIndex: number, day: number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, monthIndex, day))
}

function chunkWeeks(cells: readonly MonthCell[]): MonthCell[][] {
  const weeks: MonthCell[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

export default function MonthCalendar<T extends MonthCalendarItem>({
  items,
  initialMonth,
  ariaLabelPrefix,
  renderItem,
  onMonthChange,
}: MonthCalendarProps<T>) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const year = selectedMonth.getFullYear()
  const monthIndex = selectedMonth.getMonth()
  const label = monthLabel(year, monthIndex)
  const calendarName = ariaLabelPrefix ? `${ariaLabelPrefix} ${label} calendar` : `${label} calendar`
  const headingId = ariaLabelPrefix
    ? `${ariaLabelPrefix.toLowerCase().replace(/\s+/g, '-')}-calendar-month-heading`
    : 'calendar-month-heading'
  const cells = useMemo(() => buildMonthCells(year, monthIndex), [monthIndex, year])
  const weeks = useMemo(() => chunkWeeks(cells), [cells])
  const itemsByDate = useMemo(() => {
    const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
    const grouped = new Map<string, T[]>()

    items.forEach((item) => {
      if (!item.date.startsWith(monthPrefix)) return
      const dateItems = grouped.get(item.date) ?? []
      dateItems.push(item)
      grouped.set(item.date, dateItems)
    })

    return grouped
  }, [items, monthIndex, year])

  const previousMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)
  const previousLabel = monthLabel(previousMonth.getFullYear(), previousMonth.getMonth())
  const nextLabel = monthLabel(nextMonth.getFullYear(), nextMonth.getMonth())

  function moveMonth(offset: number) {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset, 1)
    setSelectedMonth(next)
    onMonthChange?.(next)
  }

  return (
    <div
      className="oiac-calendar__scroll oiac-month-calendar"
      role="region"
      aria-label={`${calendarName}, scroll horizontally`}
      tabIndex={0}
    >
      <section className="oiac-calendar__panel" aria-labelledby={headingId}>
        <div className="oiac-calendar__month-bar">
          <button
            className="oiac-calendar__month-button"
            type="button"
            aria-label={`Show ${previousLabel}`}
            onClick={() => moveMonth(-1)}
          >
            <LuChevronLeft aria-hidden="true" />
          </button>
          <h2 id={headingId} aria-live="polite">{label}</h2>
          <button
            className="oiac-calendar__month-button"
            type="button"
            aria-label={`Show ${nextLabel}`}
            onClick={() => moveMonth(1)}
          >
            <LuChevronRight aria-hidden="true" />
          </button>
        </div>

        <div
          className="oiac-calendar__grid"
          role="grid"
          aria-label={calendarName}
          style={{ '--calendar-week-count': weeks.length } as CSSProperties}
        >
          <div className="oiac-calendar__grid-row oiac-calendar__grid-row--weekdays" role="row">
            {weekdays.map((weekday) => <div key={weekday} role="columnheader">{weekday}</div>)}
          </div>
          {weeks.map((week, weekIndex) => (
            <div className="oiac-calendar__grid-row" role="row" key={`week-${weekIndex + 1}`}>
              {week.map((cell, dayIndex) => {
                if (!cell) {
                  return (
                    <div
                      className="oiac-calendar__day oiac-calendar__day--outside"
                      role="gridcell"
                      aria-label={`Outside ${label}`}
                      key={`outside-${weekIndex}-${dayIndex}`}
                    />
                  )
                }

                const dayItems = itemsByDate.get(cell.isoDate) ?? []
                return (
                  <div
                    className="oiac-calendar__day"
                    role="gridcell"
                    aria-label={fullDateLabel(year, monthIndex, cell.day)}
                    key={cell.isoDate}
                  >
                    <span className="oiac-calendar__day-number" aria-hidden="true">{cell.day}</span>
                    <div className="oiac-calendar__day-items">
                      {dayItems.map((item) => <Fragment key={item.id}>{renderItem(item)}</Fragment>)}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
