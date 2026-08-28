export type CalendarItem = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: 'meeting' | 'event'
  status: 'Accepted' | 'Registered'
  time: string
  location: string
  joinUrl: string
}

export type MonthCell = { day: number; isoDate: string } | null

export const calendarItems: readonly CalendarItem[] = [
  {
    id: 'event-001',
    date: '2026-09-08',
    title: 'Capitol Hill Advocacy Day',
    kind: 'event',
    status: 'Registered',
    time: 'All Day',
    location: 'Washington, D.C.',
    joinUrl: 'https://outlook.office.com/calendar/',
  },
  {
    id: 'meeting-002',
    date: '2026-09-18',
    title: 'Congressional Outreach Training Session',
    kind: 'meeting',
    status: 'Accepted',
    time: '2:00 PM ET',
    location: 'Microsoft Teams',
    joinUrl: 'https://teams.microsoft.com/',
  },
  {
    id: 'event-003',
    date: '2026-10-15',
    title: 'OIAC National Convention 2026',
    kind: 'event',
    status: 'Registered',
    time: 'All Day',
    location: 'Washington, D.C.',
    joinUrl: 'https://outlook.office.com/calendar/',
  },
]

export function buildMonthCells(year: number, monthIndex: number): MonthCell[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: MonthCell[] = Array.from({ length: firstWeekday }, () => null)
  const month = String(monthIndex + 1).padStart(2, '0')

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      isoDate: `${year}-${month}-${String(day).padStart(2, '0')}`,
    })
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function itemsForMonth(
  items: readonly CalendarItem[],
  year: number,
  monthIndex: number,
): CalendarItem[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
  return items
    .filter((item) => item.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1))
}
