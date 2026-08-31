import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { useHomeDashboardData, type HomeDashboardData } from '../features/dashboard/useHomeDashboardData'
import type { EventItem } from '../features/events/eventTypes'
import type { MeetingReportSummary } from '../features/meetingReports/meetingReportTypes'
import css from '../styles/theme.css?raw'
import Home from './Home'

vi.mock('../features/dashboard/useHomeDashboardData', () => ({ useHomeDashboardData: vi.fn() }))

const reports: readonly MeetingReportSummary[] = Array.from({ length: 5 }, (_, index) => ({
  id: `${String(index + 1).padStart(8, '0')}-1111-1111-1111-111111111111`,
  subject: `Meeting ${index + 1}`,
  representativeName: `Representative ${index + 1}`,
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

function dashboardData(overrides: Partial<HomeDashboardData> = {}): HomeDashboardData {
  return {
    reports,
    reportCount: 7,
    registeredEventCount: 2,
    upcomingEvents,
    reportsStatus: 'ready',
    registrationsStatus: 'ready',
    retry,
    ...overrides,
  }
}

function renderHome() {
  return render(<MemoryRouter><Home contactId="11111111-1111-1111-1111-111111111111" /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
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

test('keeps unfinished dashboard features visible without navigation behavior', () => {
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
  const submissions = screen.getByRole('heading', { name: 'Volunteer Submissions' }).closest('section')!

  expect(within(meetingInvites).getByText('Coming Soon')).toBeInTheDocument()
  expect(meetingInvites).toHaveClass('dashboard-panel--coming-soon')
  expect(meetingInvites).toHaveAttribute('aria-disabled', 'true')
  expect(within(announcements).getByText('Coming Soon')).toBeInTheDocument()
  expect(announcements).toHaveClass('dashboard-panel--coming-soon')
  expect(announcements).toHaveAttribute('aria-disabled', 'true')
  expect(within(training).getByText('Coming Soon')).toBeInTheDocument()
  expect(training).toHaveClass('dashboard-panel--coming-soon')
  expect(training).toHaveAttribute('aria-disabled', 'true')
  expect(within(teams).getByText('Coming Soon')).toBeInTheDocument()
  expect(teams).toHaveClass('dashboard-section--coming-soon')
  expect(teams).toHaveAttribute('aria-disabled', 'true')
  expect(within(submissions).getByText('Coming Soon')).toBeInTheDocument()
  expect(submissions).toHaveClass('dashboard-section--coming-soon')
  expect(submissions).toHaveAttribute('aria-disabled', 'true')
  expect(within(training).queryByRole('link')).not.toBeInTheDocument()
  expect(within(teams).queryByRole('link')).not.toBeInTheDocument()

  const upcomingEvents = screen.getByRole('heading', { name: 'Upcoming Events' }).closest('article')!
  expect(upcomingEvents).not.toHaveClass('dashboard-panel--coming-soon')
  expect(upcomingEvents).not.toHaveAttribute('aria-disabled')
  expect(within(upcomingEvents).getByRole('link', { name: /My Calendar/ })).toHaveAttribute('href', '/my-calendar')
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
  expect(teamResources?.querySelectorAll('.dashboard-team-card__marker svg')).toHaveLength(3)
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
