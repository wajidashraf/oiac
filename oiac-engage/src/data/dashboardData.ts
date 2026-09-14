export type DashboardMetric = {
  id: string
  value: number
  label: string
}

export type DashboardResource = {
  id: string
  title: string
  href: string
}

export type TeamResourceItem = {
  id: string
  title: string
  detail: string
  action: 'Open'
  href: string
}

export type TeamResourceGroup = {
  id: string
  title: string
  marker: string
  items: readonly TeamResourceItem[]
}

export type VolunteerSubmission = {
  id: string
  type: 'Email' | 'Appointment' | 'Event Participation'
  subject: string
  date: string
  dateTime: string
  status: 'Submitted' | 'Confirmed' | 'Completed'
}

export const dashboardMetrics: readonly DashboardMetric[] = [
  { id: 'activities-submitted', value: 0, label: 'Activities Submitted' },
  { id: 'report-submitted', value: 0, label: 'Reports Submitted' },
  { id: 'events-registered', value: 0, label: 'Events Registered' },
  { id: 'hours-volunteered', value: 0, label: 'Hours Volunteered' },
]

export const trainingResources: readonly DashboardResource[] = [
  {
    id: 'onboarding-guide',
    title: 'Volunteer Onboarding Guide',
    href: '/resources/volunteer-onboarding-guide',
  },
  {
    id: 'teams-quick-start',
    title: 'Teams Quick Start',
    href: '/resources/teams-quick-start',
  },
  {
    id: 'report-instructions',
    title: 'Meeting Report Instructions',
    href: '/resources/meeting-report-instructions',
  },
]

export const teamResourceGroups: readonly TeamResourceGroup[] = [
  {
    id: 'important-channels',
    title: 'Important Channels',
    marker: '#',
    items: [
      { id: 'advocacy-channel', title: '#advocacy-2026', detail: 'Main advocacy coordination channel', action: 'Open', href: '/resources' },
      { id: 'dc-channel', title: '#dc-volunteers', detail: 'DC district volunteer updates', action: 'Open', href: '/resources' },
      { id: 'announcements-channel', title: '#announcements', detail: 'Org-wide announcements from staff', action: 'Open', href: '/resources' },
      { id: 'training-channel', title: '#training-resources', detail: 'Guides, docs, and onboarding', action: 'Open', href: '/resources' },
    ],
  },
  {
    id: 'recent-documents',
    title: 'Recent Documents',
    marker: 'D',
    items: [
      { id: 'talking-points', title: 'Advocacy Day Talking Points', detail: 'PDF', action: 'Open', href: '/resources' },
      { id: 'volunteer-handbook', title: 'Volunteer Handbook 2026', detail: 'PDF', action: 'Open', href: '/resources' },
      { id: 'contact-list', title: 'Congressional Contact List', detail: 'Spreadsheet', action: 'Open', href: '/resources' },
      { id: 'report-template', title: 'Meeting Report Template', detail: 'Word', action: 'Open', href: '/resources' },
    ],
  },
]

export const volunteerSubmissions: readonly VolunteerSubmission[] = [
  {
    id: 'email-johnson-office',
    type: 'Email',
    subject: 'Outreach to Rep. Johnson office re: Iranian American issues',
    date: 'Aug 13, 2026',
    dateTime: '2026-08-13',
    status: 'Submitted',
  },
  {
    id: 'carter-policy-meeting',
    type: 'Appointment',
    subject: 'Meeting with Sen. Carter staff — immigration policy',
    date: 'Aug 10, 2026',
    dateTime: '2026-08-10',
    status: 'Confirmed',
  },
  {
    id: 'chicago-community-forum',
    type: 'Event Participation',
    subject: 'Participated in Community Forum — Chicago',
    date: 'Jul 28, 2026',
    dateTime: '2026-07-28',
    status: 'Completed',
  },
]
