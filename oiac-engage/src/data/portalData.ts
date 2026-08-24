export type ReportRecord = {
  id: string
  title: string
  period: string
  status: 'Available' | 'In review'
  updated: string
}

export type AgendaItem = {
  id: string
  title: string
  date: string
  time: string
  type: 'Event' | 'Appointment'
}

export type ActivityItem = {
  id: string
  title: string
  description: string
  timestamp: string
  category: 'Report' | 'Event' | 'Appointment' | 'Account'
}

export type EventRecord = {
  id: string
  title: string
  date: string
  time: string
  location: string
  status: 'Registered' | 'Open' | 'Attended'
  description: string
}

export type AppointmentRecord = {
  id: string
  title: string
  date: string
  time: string
  with: string
  status: 'Confirmed' | 'Pending' | 'Completed'
}

export type PressCoverageRecord = {
  id: string
  publication: string
  headline: string
  date: string
  summary: string
  topic: string
}

export const reports: readonly ReportRecord[] = [
  { id: 'report-001', title: 'Member engagement summary', period: 'July 2026', status: 'Available', updated: '18 Aug 2026' },
  { id: 'report-002', title: 'Programme participation report', period: 'Q2 2026', status: 'Available', updated: '04 Aug 2026' },
  { id: 'report-003', title: 'Annual member statement', period: '2025–2026', status: 'In review', updated: '29 Jul 2026' },
]

export const agendaItems: readonly AgendaItem[] = [
  { id: 'agenda-001', title: 'Member briefing session', date: '27 Aug 2026', time: '10:00 AM', type: 'Event' },
  { id: 'agenda-002', title: 'Programme consultation', date: '02 Sep 2026', time: '2:30 PM', type: 'Appointment' },
  { id: 'agenda-003', title: 'Regional networking forum', date: '09 Sep 2026', time: '11:00 AM', type: 'Event' },
]

export const activityItems: readonly ActivityItem[] = [
  { id: 'activity-001', title: 'Report became available', description: 'The July member engagement summary is ready to view.', timestamp: '18 Aug 2026, 9:15 AM', category: 'Report' },
  { id: 'activity-002', title: 'Event registration confirmed', description: 'Your place at the member briefing session was confirmed.', timestamp: '15 Aug 2026, 4:40 PM', category: 'Event' },
  { id: 'activity-003', title: 'Appointment updated', description: 'The programme consultation time was moved to 2:30 PM.', timestamp: '12 Aug 2026, 11:05 AM', category: 'Appointment' },
]

export const events: readonly EventRecord[] = [
  { id: 'event-001', title: 'Member briefing session', date: '27 Aug 2026', time: '10:00 AM–11:30 AM', location: 'Online', status: 'Registered', description: 'A focused update on current initiatives, timelines, and member opportunities.' },
  { id: 'event-002', title: 'Regional networking forum', date: '09 Sep 2026', time: '11:00 AM–2:00 PM', location: 'Community Conference Centre', status: 'Open', description: 'Connect with fellow members and hear short programme updates.' },
  { id: 'event-003', title: 'Annual member roundtable', date: '18 Jun 2026', time: '9:30 AM–12:00 PM', location: 'OIAC Meeting Hall', status: 'Attended', description: 'A collaborative discussion about priorities for the coming year.' },
]

export const appointments: readonly AppointmentRecord[] = [
  { id: 'appointment-001', title: 'Programme consultation', date: '02 Sep 2026', time: '2:30 PM', with: 'Member Services', status: 'Confirmed' },
  { id: 'appointment-002', title: 'Report follow-up', date: '11 Sep 2026', time: '10:15 AM', with: 'Insights Team', status: 'Pending' },
  { id: 'appointment-003', title: 'Membership review', date: '06 Aug 2026', time: '1:00 PM', with: 'Member Services', status: 'Completed' },
]

export const pressCoverage: readonly PressCoverageRecord[] = [
  { id: 'press-001', publication: 'Community Review', headline: 'Partnership programme expands opportunities for members', date: '14 Aug 2026', summary: 'Coverage highlights the latest programme milestone and its practical benefits for participating members.', topic: 'Partnerships' },
  { id: 'press-002', publication: 'Regional Brief', headline: 'Member-led forum sets priorities for the year ahead', date: '28 Jul 2026', summary: 'A recap of the annual forum and the themes raised by members across the region.', topic: 'Member voice' },
  { id: 'press-003', publication: 'Public Affairs Journal', headline: 'New engagement model puts accessible services first', date: '09 Jul 2026', summary: 'An overview of the service improvements designed to make participation simpler and more transparent.', topic: 'Services' },
]
