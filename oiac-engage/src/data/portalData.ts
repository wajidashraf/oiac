export type ReportRecord = {
  id: string
  title: string
  period: string
  status: 'Available' | 'In review'
  updated: string
}

export type ActivityType = 'Email' | 'Appointment' | 'Event Participation'

export type ActivityItem = {
  id: string
  type: ActivityType
  subject: string
  date: string
  status: 'Submitted' | 'Confirmed' | 'Completed'
  contact: string
  notes: string
}

export type AppointmentRecord = {
  id: string
  title: string
  date: string
  time: string
  with: string
  status: 'Confirmed' | 'Pending' | 'Completed'
  joinUrl?: string
  agenda?: string
  location?: string
}

export type PressCoverageRecord = {
  id: string
  newsTitle: string
  date: string
  source: '' | 'National' | 'Online' | 'Local'
  coverageType: '' | 'News Article' | 'Feature' | 'Interview'
  sentiment: '' | 'Positive' | 'Neutral' | 'Negative'
  country: string
  url: string
  pressAccount: string
  language: string
  rating: string
  regardingEvent: string
  mentions: string
}

export const reports: readonly ReportRecord[] = [
  { id: 'report-001', title: 'Member engagement summary', period: 'July 2026', status: 'Available', updated: '18 Aug 2026' },
  { id: 'report-002', title: 'Programme participation report', period: 'Q2 2026', status: 'Available', updated: '04 Aug 2026' },
  { id: 'report-003', title: 'Annual member statement', period: '2025–2026', status: 'In review', updated: '29 Jul 2026' },
]

export const activityItems: readonly ActivityItem[] = [
  {
    id: 'activity-001',
    type: 'Email',
    subject: 'Outreach to Rep. Johnson office re: Iranian American issues',
    date: '2026-08-13',
    status: 'Submitted',
    contact: 'office@sen.johnson.gov',
    notes: '',
  },
  {
    id: 'activity-002',
    type: 'Appointment',
    subject: 'Meeting with Sen. Carter staff — immigration policy',
    date: '2026-08-10',
    status: 'Confirmed',
    contact: 'Sen. Carter staff',
    notes: '',
  },
  {
    id: 'activity-003',
    type: 'Event Participation',
    subject: 'Participated in Community Forum — Chicago',
    date: '2026-07-28',
    status: 'Completed',
    contact: 'Community Forum',
    notes: '',
  },
]

export const appointments: readonly AppointmentRecord[] = [
  {
    id: 'appointment-001',
    title: 'Meeting with Sen. Miller Staff — Immigration Policy',
    date: 'Sep 8, 2026',
    time: '10:00 AM',
    with: "Sen. Miller's Office",
    status: 'Confirmed',
    joinUrl: '',
  },
  {
    id: 'appointment-002',
    title: 'District Outreach Planning Session',
    date: 'Sep 15, 2026',
    time: '2:00 PM',
    with: 'OIAC DC Office',
    status: 'Pending',
  },
  {
    id: 'appointment-003',
    title: 'Advocacy Briefing — Rep. Chen Office',
    date: 'Aug 5, 2026',
    time: '11:00 AM',
    with: "Rep. Chen's Office",
    status: 'Completed',
  },
]

export const pressCoverage: readonly PressCoverageRecord[] = [
  {
    id: 'press-001',
    newsTitle: 'Iranian Americans Advocate for Sanctions Relief on Capitol Hill',
    date: '2026-08-12',
    source: 'National',
    coverageType: 'News Article',
    sentiment: 'Positive',
    country: 'United States',
    url: '',
    pressAccount: '',
    language: 'English',
    rating: '',
    regardingEvent: '',
    mentions: '',
  },
  {
    id: 'press-002',
    newsTitle: 'OIAC Convention Draws Record Attendance in DC',
    date: '2026-07-30',
    source: 'Online',
    coverageType: 'Feature',
    sentiment: 'Positive',
    country: 'United States',
    url: '',
    pressAccount: '',
    language: 'English',
    rating: '',
    regardingEvent: '',
    mentions: '',
  },
  {
    id: 'press-003',
    newsTitle: 'Community Leaders Discuss Iranian Heritage Month Programs',
    date: '2026-06-18',
    source: 'Local',
    coverageType: 'Interview',
    sentiment: 'Neutral',
    country: 'United States',
    url: '',
    pressAccount: '',
    language: 'English',
    rating: '',
    regardingEvent: '',
    mentions: '',
  },
]
