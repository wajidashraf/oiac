export type EventCategory = 'Convention' | 'Rally' | 'Advocacy Day' | 'Briefing'

export type EventPageStatus = 'Registration Open' | 'Upcoming' | 'Completed'

export type EventItem = {
  id: string
  title: string
  date: `${number}-${number}-${number}`
  location: string
  category: EventCategory
  status: EventPageStatus
  registered: boolean
}

export const eventItems: readonly EventItem[] = [
  {
    id: 'directory-event-001',
    title: 'OIAC National Convention 2026',
    date: '2026-10-15',
    location: 'Washington, D.C.',
    category: 'Convention',
    status: 'Registration Open',
    registered: true,
  },
  {
    id: 'directory-event-002',
    title: 'Iranian American Rights Rally — Los Angeles',
    date: '2026-09-20',
    location: 'Los Angeles, CA',
    category: 'Rally',
    status: 'Upcoming',
    registered: false,
  },
  {
    id: 'directory-event-003',
    title: 'Capitol Hill Advocacy Day',
    date: '2026-09-08',
    location: 'Washington, D.C.',
    category: 'Advocacy Day',
    status: 'Upcoming',
    registered: true,
  },
  {
    id: 'directory-event-004',
    title: 'Volunteer Captain Briefing',
    date: '2026-09-15',
    location: 'Microsoft Teams',
    category: 'Briefing',
    status: 'Registration Open',
    registered: false,
  },
  {
    id: 'directory-event-005',
    title: 'State Coalition Summit — Texas',
    date: '2026-08-28',
    location: 'Houston, TX',
    category: 'Convention',
    status: 'Completed',
    registered: false,
  },
  {
    id: 'directory-event-006',
    title: 'Iranian American Heritage Month Kickoff',
    date: '2026-10-02',
    location: 'New York, NY',
    category: 'Rally',
    status: 'Upcoming',
    registered: false,
  },
]

export function eventDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, day))
}
