import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { useHomeDashboardData, type HomeDashboardData } from '../features/dashboard/useHomeDashboardData'
import type { EventItem } from '../features/events/eventTypes'
import { MEETING_INVITATION_STATUS, type MeetingInvite } from '../features/meetingInvites/meetingInviteTypes'
import type { MeetingReportSummary } from '../features/meetingReports/meetingReportTypes'
import type { TeamAnnouncement } from '../features/teamAnnouncements/teamAnnouncementTypes'
import css from '../styles/theme.css?raw'
import Home from './Home'

vi.mock('../features/dashboard/useHomeDashboardData', () => ({ useHomeDashboardData: vi.fn() }))

const reports: readonly MeetingReportSummary[] = Array.from({ length: 5 }, (_, index) => ({
  id: `${String(index + 1).padStart(8, '0')}-1111-1111-1111-111111111111`,
  subject: `Meeting ${index + 1}`,
  representativeName: `Representative ${index + 1}`,
  districtName: index === 0 ? 'DC' : `District ${index + 1}`,
  date: `2026-08-${String(28 - index).padStart(2, '0')}T12:00:00Z`,
  sentimentLabel: index === 0 ? 'Supportive' : 'Neutral',
}))

const upcomingEvents: readonly EventItem[] = [
  ['22222222-2222-2222-2222-222222222222', 'Registered Capitol Briefing', '2026-09-08T14:00:00Z'],
  ['33333333-3333-3333-3333-333333333333', 'Registered Volunteer Webinar', '2026-09-15T18:00:00Z'],
].map(([id, title, startDateTime]) => ({
  id,
  title,
  startDateTime,
  endDateTime: startDateTime,
  eventFormat: 'Virtual',
  eventFormatValue: 866530001,
  eventStatus: 'Registration Open',
  eventStatusValue: 866530002,
  eventType: 'Meeting',
  eventTypeValue: 866530002,
  meetingUrl: 'https://example.com/meeting',
  venueName: null,
  description: null,
}))

const retry = vi.fn()
const retryInvites = vi.fn()
const retryAnnouncements = vi.fn()
const acceptInvite = vi.fn().mockResolvedValue(undefined)
const dashboardInvites: readonly MeetingInvite[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Pending District Briefing',
    startDateTime: '2026-09-18T18:00:00Z',
    endDateTime: '2026-09-18T19:00:00Z',
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/pending-district-briefing',
    participant: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      contactId: '11111111-1111-1111-1111-111111111111',
      meetingInviteId: '44444444-4444-4444-8444-444444444444',
      status: MEETING_INVITATION_STATUS.pending,
      acceptedOn: null,
      name: 'Pending District Briefing - Sara Rahimi',
    },
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Accepted Volunteer Briefing',
    startDateTime: '2026-09-20T14:00:00Z',
    endDateTime: null,
    meetingLink: 'https://outlook.office.com/calendar/item/accepted-volunteer-briefing',
    participant: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      contactId: '11111111-1111-1111-1111-111111111111',
      meetingInviteId: '55555555-5555-4555-8555-555555555555',
      status: MEETING_INVITATION_STATUS.accepted,
      acceptedOn: '2026-09-12T14:30:00Z',
      name: 'Accepted Volunteer Briefing - Sara Rahimi',
    },
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'New Volunteer Invitation',
    startDateTime: '2026-09-21T15:00:00Z',
    endDateTime: null,
    meetingLink: null,
    participant: null,
  },
]

const dashboardAnnouncements: readonly TeamAnnouncement[] = [
  {
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Advocacy briefing materials',
    content: 'Please review the latest briefing materials before the meeting.',
    startDateTime: '2026-09-12T13:00:00Z',
    endDateTime: '2026-09-13T13:00:00Z',
    link: 'https://example.com/briefing',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    title: 'Volunteer channel update',
    content: 'A new volunteer channel is now available.',
    startDateTime: '2026-09-11T13:00:00Z',
    endDateTime: '2026-09-14T13:00:00Z',
    link: null,
  },
]

function dashboardData(overrides: Partial<HomeDashboardData> = {}): HomeDashboardData {
  return {
    reports,
    reportCount: 7,
    registeredEventCount: 2,
    upcomingEvents,
    reportsStatus: 'ready',
    registrationsStatus: 'ready',
    registrationsFailureKind: null,
    meetingInvites: dashboardInvites,
    upcomingMeetings: dashboardInvites,
    invitesStatus: 'ready',
    invitesFailureKind: null,
    teamAnnouncements: dashboardAnnouncements,
    announcementsStatus: 'ready',
    acceptingInviteIds: new Set(),
    inviteError: null,
    acceptInvite,
    retryInvites,
    retryAnnouncements,
    retry,
    ...overrides,
  }
}

function renderHome() {
  return render(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  acceptInvite.mockResolvedValue(undefined)
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData())
})

test('renders the volunteer dashboard and its operational sections', () => {
  renderHome()

  expect(screen.getByRole('heading', { name: 'Volunteer', level: 1 })).toBeInTheDocument()
  const summary = screen.getByRole('group', { name: 'Volunteer summary' })
  expect(summary).toHaveTextContent('0Activities Submitted')
  expect(summary).toHaveTextContent('7Reports Submitted')
  expect(summary).toHaveTextContent('2Events Registered')
  expect(summary).toHaveTextContent('0Hours Volunteered')
  expect(screen.getByRole('heading', { name: 'Meeting Reports' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Upcoming Events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Meeting Invites' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams Announcements' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Training Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams & Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Volunteer Submissions' })).toBeInTheDocument()
  expect(document.title).toBe('Volunteer Dashboard — OIAC Engage')
})

test('keeps unfinished dashboard features visible while training resources are live', () => {
  renderHome()

  const shortcuts = screen.getByRole('navigation', { name: 'Dashboard shortcuts' })
  expect(within(shortcuts).queryByRole('link', { name: /Activity/ })).not.toBeInTheDocument()
  expect(within(shortcuts).queryByRole('link', { name: /Appointments/ })).not.toBeInTheDocument()
  const activityShortcut = within(shortcuts).getByText('Activity').closest<HTMLElement>('[aria-disabled="true"]')!
  const appointmentsShortcut = within(shortcuts).getByText('Appointments').closest<HTMLElement>('[aria-disabled="true"]')!
  expect(activityShortcut).toBeInTheDocument()
  expect(activityShortcut).toHaveClass('dashboard-shortcut--coming-soon')
  expect(appointmentsShortcut).toBeInTheDocument()
  expect(appointmentsShortcut).toHaveClass('dashboard-shortcut--coming-soon')
  expect(within(shortcuts).getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/activity/events')
  expect(within(shortcuts).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources')

  const meetingInvites = screen.getByRole('heading', { name: 'Meeting Invites' }).closest('article')!
  const announcements = screen.getByRole('heading', { name: 'Teams Announcements' }).closest('article')!
  const training = screen.getByRole('heading', { name: 'Training Resources' }).closest('article')!
  const teams = screen.getByRole('heading', { name: 'Teams & Resources' }).closest('section')!
  const upcomingMeetings = within(teams).getByRole('heading', { name: 'Upcoming Meetings' }).closest('article')!
  const importantChannels = within(teams).getByRole('heading', { name: 'Important Channels' }).closest('article')!
  expect(within(teams).queryByRole('heading', { name: 'Recent Documents', hidden: true })).not.toBeInTheDocument()
  const submissions = screen.getByRole('heading', { name: 'Volunteer Submissions' }).closest('section')!

  expect(within(meetingInvites).queryByText('Coming Soon')).not.toBeInTheDocument()
  expect(meetingInvites).not.toHaveClass('dashboard-panel--coming-soon')
  expect(meetingInvites).not.toHaveAttribute('aria-disabled')
  expect(within(announcements).queryByText('Coming Soon')).not.toBeInTheDocument()
  expect(announcements).not.toHaveClass('dashboard-panel--coming-soon')
  expect(announcements).not.toHaveAttribute('aria-disabled')
  expect(within(training).queryByText('Coming Soon')).not.toBeInTheDocument()
  expect(training).not.toHaveClass('dashboard-panel--coming-soon')
  expect(training).not.toHaveAttribute('aria-disabled')
  expect(within(training).getByRole('link', { name: 'Volunteer Onboarding Guide' })).toHaveAttribute(
    'href',
    '/resources/volunteer-onboarding-guide',
  )
  expect(within(training).getByRole('link', { name: 'Teams Quick Start' })).toHaveAttribute(
    'href',
    '/resources/teams-quick-start',
  )
  expect(within(training).getByRole('link', { name: 'Meeting Report Instructions' })).toHaveAttribute(
    'href',
    '/resources/meeting-report-instructions',
  )
  expect(teams).not.toHaveClass('dashboard-section--coming-soon')
  expect(teams).not.toHaveAttribute('aria-disabled')
  expect(upcomingMeetings).not.toHaveClass('dashboard-panel--coming-soon')
  expect(upcomingMeetings).not.toHaveAttribute('aria-disabled')
  for (const placeholder of [importantChannels]) {
    expect(within(placeholder).getByText('Coming Soon')).toBeInTheDocument()
    expect(placeholder).toHaveClass('dashboard-panel--coming-soon')
    expect(placeholder).toHaveAttribute('aria-disabled', 'true')
    expect(within(placeholder).queryByRole('link')).not.toBeInTheDocument()
  }
  expect(within(submissions).getByText('Coming Soon')).toBeInTheDocument()
  expect(submissions).toHaveClass('dashboard-section--coming-soon')
  expect(submissions).toHaveAttribute('aria-disabled', 'true')
  expect(within(training).getAllByRole('link')).toHaveLength(3)
  expect(within(upcomingMeetings).getByRole('link', {
    name: 'Join Pending District Briefing in a new tab',
  })).toBeInTheDocument()

  const upcomingEvents = screen.getByRole('heading', { name: 'Upcoming Events' }).closest('article')!
  expect(upcomingEvents).not.toHaveClass('dashboard-panel--coming-soon')
  expect(upcomingEvents).not.toHaveAttribute('aria-disabled')
  expect(within(upcomingEvents).getByRole('link', { name: /My Calendar/ })).toHaveAttribute('href', '/my-calendar')
})

test('opens Event details only from an Upcoming Event title', async () => {
  const actor = userEvent.setup()
  renderHome()
  const panel = screen.getByRole('heading', { name: 'Upcoming Events' }).closest('article')!
  const rows = within(panel).getAllByRole('listitem')
  const titleButton = within(rows[0]).getByRole('button', { name: 'Registered Capitol Briefing' })

  expect(within(rows[0]).getByRole('time')).toHaveAttribute('datetime', upcomingEvents[0].startDateTime)
  expect(within(rows[0]).queryByRole('link')).not.toBeInTheDocument()
  await actor.click(titleButton)

  const dialog = screen.getByRole('dialog', { name: 'Registered Capitol Briefing' })
  expect(within(dialog).getByText('Virtual')).toBeInTheDocument()
  expect(within(dialog).getByText('Meeting')).toBeInTheDocument()
  expect(within(dialog).getByRole('link', { name: 'Join meeting' })).toHaveAttribute(
    'href',
    'https://example.com/meeting',
  )
})

test('renders every upcoming meeting with provider-neutral join links and unavailable fallback', () => {
  renderHome()
  const panel = screen.getByRole('heading', { name: 'Upcoming Meetings' }).closest('article')!
  const rows = within(panel).getAllByRole('listitem')

  expect(rows).toHaveLength(3)
  expect(rows.map((row) => within(row).getByRole('strong').textContent)).toEqual([
    'Pending District Briefing',
    'Accepted Volunteer Briefing',
    'New Volunteer Invitation',
  ])
  const teamsLink = within(panel).getByRole('link', {
    name: 'Join Pending District Briefing in a new tab',
  })
  expect(teamsLink).toHaveTextContent('Join Link')
  expect(teamsLink).toHaveAttribute(
    'href',
    'https://teams.microsoft.com/l/meetup-join/pending-district-briefing',
  )
  expect(teamsLink).toHaveAttribute('target', '_blank')
  expect(teamsLink).toHaveAttribute('rel', 'noreferrer')
  expect(teamsLink.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(within(panel).getByRole('link', {
    name: 'Join Accepted Volunteer Briefing in a new tab',
  })).toHaveAttribute(
    'href',
    'https://outlook.office.com/calendar/item/accepted-volunteer-briefing',
  )
  const unavailableRow = rows[2]
  expect(within(unavailableRow).getByText('Link unavailable')).toBeInTheDocument()
  expect(within(unavailableRow).queryByRole('link')).not.toBeInTheDocument()
  expect(within(panel).queryByText('Advocacy Coordination Call')).not.toBeInTheDocument()
  expect(within(panel).queryByText('Training: CRM Walkthrough')).not.toBeInTheDocument()
})

test('shows loading, error with retry, and empty states for upcoming meetings', async () => {
  const actor = userEvent.setup()
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    upcomingMeetings: [],
    invitesStatus: 'loading',
  }))
  const { rerender } = renderHome()
  let panel = screen.getByRole('heading', { name: 'Upcoming Meetings' }).closest('article')!
  expect(within(panel).getByText(/Loading upcoming meetings/)).toBeInTheDocument()

  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    upcomingMeetings: [],
    invitesStatus: 'error',
  }))
  rerender(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
  panel = screen.getByRole('heading', { name: 'Upcoming Meetings' }).closest('article')!
  expect(within(panel).getByText('Upcoming meetings could not be loaded.')).toBeInTheDocument()
  await actor.click(within(panel).getByRole('button', {
    name: 'Try loading upcoming meetings again',
  }))
  expect(retryInvites).toHaveBeenCalledOnce()

  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    upcomingMeetings: [],
    invitesStatus: 'ready',
  }))
  rerender(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
  panel = screen.getByRole('heading', { name: 'Upcoming Meetings' }).closest('article')!
  expect(within(panel).getByText('No upcoming meetings.')).toBeInTheDocument()
})

test('renders live meeting invites with Accepted read-only and Accept for every actionable status', async () => {
  renderHome()
  const panel = screen.getByRole('heading', { name: 'Meeting Invites' }).closest('article')!
  const inviteRegion = within(panel).getByRole('region', { name: 'Meeting Invites list' })

  expect(inviteRegion).toHaveAttribute('tabindex', '0')
  expect(within(panel).getByText('Sep 18, 2026 · 2:00 PM ET')).toBeInTheDocument()
  expect(within(panel).getByText('Accepted')).toBeInTheDocument()
  expect(within(panel).getAllByRole('button', { name: /^Accept / })).toHaveLength(2)

  await userEvent.click(within(panel).getByRole('button', { name: 'Accept Pending District Briefing' }))
  expect(acceptInvite).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444')
})

test('disables the Accept button while its invitation is being saved', () => {
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    acceptingInviteIds: new Set(['44444444-4444-4444-8444-444444444444']),
  }))
  renderHome()

  const button = screen.getByRole('button', { name: 'Accepting Pending District Briefing' })
  expect(button).toBeDisabled()
  expect(button).toHaveTextContent('Accepting…')
})

test('shows invitation load and accept errors through inline dashboard UI', async () => {
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    meetingInvites: [],
    invitesStatus: 'error',
    inviteError: 'District Briefing could not be accepted. Try again.',
  }))
  renderHome()

  expect(screen.getByText('Meeting invites could not be loaded.')).toBeInTheDocument()
  expect(screen.getByText('District Briefing could not be accepted. Try again.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Try loading meeting invites again' }))
  expect(retryInvites).toHaveBeenCalledOnce()
})

test('distinguishes successful-response processing errors from API load errors', () => {
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    upcomingEvents: [],
    registrationsStatus: 'error',
    registrationsFailureKind: 'processing',
    meetingInvites: [],
    upcomingMeetings: [],
    invitesStatus: 'error',
    invitesFailureKind: 'processing',
  }))
  renderHome()

  expect(screen.getByText('Some saved event registration data could not be processed.')).toBeInTheDocument()
  expect(screen.getByText('Some meeting invitation data for this account could not be processed.')).toBeInTheDocument()
  expect(screen.getByText('Returned meeting data could not be processed.')).toBeInTheDocument()
  expect(screen.queryByText('Your registered events could not be loaded.')).not.toBeInTheDocument()
})

test('limits the invite viewport to five rows and hides only the scrollbar chrome', () => {
  expect(css).toMatch(/\.dashboard-invite-scroll\s*\{[^}]*max-height:\s*calc\(var\(--dashboard-row-height\)\s*\*\s*5\)/s)
  expect(css).toMatch(/\.dashboard-invite-scroll\s*\{[^}]*overflow-y:\s*auto/s)
  expect(css).toMatch(/\.dashboard-invite-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
})

test('renders live Teams announcements and opens row details in a modal', async () => {
  const actor = userEvent.setup()
  renderHome()
  const panel = screen.getByRole('heading', { name: 'Teams Announcements' }).closest('article')!
  const listRegion = within(panel).getByRole('region', { name: 'Teams Announcements list' })

  expect(listRegion).toHaveAttribute('tabindex', '0')
  expect(within(panel).getByRole('button', { name: 'View Advocacy briefing materials' })).toBeInTheDocument()
  expect(within(panel).getByText('Sep 12, 2026 · 9:00 AM ET')).toBeInTheDocument()
  expect(within(panel).getByLabelText('Advocacy briefing materials has an external link')).toBeInTheDocument()
  expect(within(panel).queryByLabelText('Volunteer channel update has an external link')).not.toBeInTheDocument()

  await actor.click(within(panel).getByRole('button', { name: 'View Advocacy briefing materials' }))

  const dialog = screen.getByRole('dialog', { name: 'Advocacy briefing materials' })
  expect(within(dialog).getByText('Please review the latest briefing materials before the meeting.')).toBeInTheDocument()
  expect(within(dialog).getByText('Sep 12, 2026 · 9:00 AM ET')).toBeInTheDocument()
  expect(within(dialog).getByRole('link', { name: 'Open announcement' })).toHaveAttribute(
    'href',
    'https://example.com/briefing',
  )

  await actor.click(within(dialog).getByRole('button', { name: 'Close announcement' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'View Advocacy briefing materials' })).toHaveFocus()
})

test('shows independent loading, error, retry, and empty states for Teams announcements', async () => {
  const actor = userEvent.setup()
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    teamAnnouncements: [],
    announcementsStatus: 'error',
  }))
  const { rerender } = renderHome()

  expect(screen.getByText('Teams announcements could not be loaded.')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Try loading Teams announcements again' }))
  expect(retryAnnouncements).toHaveBeenCalledOnce()

  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    teamAnnouncements: [],
    announcementsStatus: 'loading',
  }))
  rerender(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
  expect(screen.getByText('Loading Teams announcements…')).toBeInTheDocument()

  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    teamAnnouncements: [],
    announcementsStatus: 'ready',
  }))
  rerender(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
  expect(screen.getByText('There are no active Teams announcements.')).toBeInTheDocument()
})

test('limits the announcement viewport to five rows and hides its scrollbar chrome', () => {
  expect(css).toMatch(/\.dashboard-announcement-scroll\s*\{[^}]*max-height:\s*calc\(var\(--dashboard-row-height\)\s*\*\s*5\)/s)
  expect(css).toMatch(/\.dashboard-announcement-scroll\s*\{[^}]*overflow-y:\s*auto/s)
  expect(css).toMatch(/\.dashboard-announcement-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
})

test('renders the five latest authenticated-user reports from dashboard data', async () => {
  renderHome()

  const reportsTable = await screen.findByRole('table', { name: 'Meeting Reports' })
  expect(within(reportsTable).getAllByRole('row')).toHaveLength(6)
  expect(within(reportsTable).getByText('Meeting 1')).toBeInTheDocument()
  expect(useHomeDashboardData).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
  expect(screen.getByRole('link', { name: 'View all reports' })).toHaveAttribute('href', '/report')
})

test('renders both dashboard datasets as semantic tables', async () => {
  renderHome()

  const reportsTable = await screen.findByRole('table', { name: 'Meeting Reports' })
  expect(within(reportsTable).getByRole('columnheader', { name: 'Meeting' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Representative' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Start' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Outcome' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'District' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('cell', { name: 'DC' })).toBeInTheDocument()
  expect(within(reportsTable).queryByRole('columnheader', { name: 'Files' })).not.toBeInTheDocument()

  const submissionsTable = screen.getByRole('table', { name: 'Volunteer Submissions' })
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Subject' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
})

test('exposes report and event dates as semantic time elements', async () => {
  renderHome()

  const reportsTable = await screen.findByRole('table', { name: 'Meeting Reports' })
  const reportTime = reportsTable.querySelector('time[datetime="2026-08-28T12:00:00Z"]')
  expect(reportTime).toHaveTextContent(/\d{1,2}:\d{2} (AM|PM)/)
  const septemberDates = screen.getAllByText('Sep', { selector: 'time span' })
  expect(septemberDates).toHaveLength(2)
  expect(septemberDates[0].closest('time')).toHaveAttribute('datetime', '2026-09-08T14:00:00Z')
})

test('routes submit, view-all, and report edit actions correctly', async () => {
  renderHome()

  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report/new')
  expect(screen.getByRole('link', { name: 'View all reports' })).toHaveAttribute('href', '/report')
  const editLinks = await screen.findAllByRole('link', { name: /^Edit / })
  expect(editLinks).toHaveLength(5)
  expect(editLinks[0]).toHaveAttribute('href', `/report/${reports[0].id}/edit`)
})

test('shows an error state when latest reports cannot be loaded', async () => {
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    reports: [],
    reportCount: null,
    reportsStatus: 'error',
  }))
  renderHome()

  expect(await screen.findByRole('alert')).toHaveTextContent('Meeting reports could not be loaded')
  expect(screen.queryByRole('table', { name: 'Meeting Reports' })).not.toBeInTheDocument()
})

test('shows a friendly registration prompt when the user has no registered upcoming events', () => {
  vi.mocked(useHomeDashboardData).mockReturnValue(dashboardData({
    registeredEventCount: 0,
    upcomingEvents: [],
  }))
  renderHome()

  const panel = screen.getByRole('heading', { name: 'Upcoming Events' }).closest('article')!
  expect(within(panel)).toBeTruthy()
  expect(within(panel).getByText(/You have no registered events yet/i)).toBeInTheDocument()
  expect(within(panel).getByRole('link', { name: 'Browse events' })).toHaveAttribute('href', '/activity/events')
})

test('uses consistent vector icons for dashboard resources', () => {
  renderHome()

  const training = screen.getByRole('heading', { name: 'Training Resources' }).closest('article')
  expect(training?.querySelectorAll('.dashboard-list-icon svg')).toHaveLength(3)

  const teamResources = screen.getByRole('heading', { name: 'Teams & Resources' }).closest('section')
  expect(teamResources?.querySelectorAll('.dashboard-team-card__marker svg')).toHaveLength(2)
})

test('keeps operational headings outside the bordered list cards', () => {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  renderHome()

  const panel = screen.getByRole('heading', { name: 'Upcoming Events' }).closest('article')
  const matchingBorders = Array.from(style.sheet!.cssRules)
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && panel!.matches(rule.selectorText) && Boolean(rule.style.border))
    .map((rule) => rule.style.border)

  expect(matchingBorders[matchingBorders.length - 1]).toBe('0')
  style.remove()
})
