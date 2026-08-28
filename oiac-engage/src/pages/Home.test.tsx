import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import css from '../styles/theme.css?raw'
import Home from './Home'

function renderHome() {
  return render(<MemoryRouter><Home /></MemoryRouter>)
}

test('renders the volunteer dashboard and its operational sections', () => {
  renderHome()

  expect(screen.getByRole('heading', { name: 'Volunteer', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Volunteer summary' })).toHaveTextContent('12')
  expect(screen.getByRole('heading', { name: 'Meeting Reports' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Upcoming Events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Meeting Invites' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams Announcements' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Training Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams & Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Volunteer Submissions' })).toBeInTheDocument()
  expect(document.title).toBe('Volunteer Dashboard — OIAC Engage')
})

test('renders both dashboard datasets as semantic tables', () => {
  renderHome()

  const reportsTable = screen.getByRole('table', { name: 'Meeting Reports' })
  expect(within(reportsTable).getByRole('columnheader', { name: 'Meeting' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Representative' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
  expect(within(reportsTable).getByRole('columnheader', { name: 'Outcome' })).toBeInTheDocument()

  const submissionsTable = screen.getByRole('table', { name: 'Volunteer Submissions' })
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Subject' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
  expect(within(submissionsTable).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
})

test('exposes upcoming event dates as semantic time elements', () => {
  renderHome()

  const septemberDates = screen.getAllByText('Sep', { selector: 'time span' })
  expect(septemberDates).toHaveLength(2)
  expect(septemberDates[0].closest('time')).toHaveAttribute('datetime', '2026-09-08')
  expect(screen.getByText('Oct', { selector: 'time span' }).closest('time')).toHaveAttribute('datetime', '2026-10-02')

  const reportsTable = screen.getByRole('table', { name: 'Meeting Reports' })
  expect(within(reportsTable).getByText('Aug 5, 2026').closest('time')).toHaveAttribute('datetime', '2026-08-05')

  const submissionsTable = screen.getByRole('table', { name: 'Volunteer Submissions' })
  expect(within(submissionsTable).getByText('Aug 13, 2026').closest('time')).toHaveAttribute('datetime', '2026-08-13')
})

test('routes submit and report edit actions to distinct create and edit pages', () => {
  renderHome()

  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report/new')
  const editLinks = screen.getAllByRole('link', { name: /^Edit / })
  expect(editLinks).toHaveLength(3)
  expect(editLinks[0]).toHaveAttribute('href', '/report/advocacy-briefing-chen/edit')
  expect(editLinks[1]).toHaveAttribute('href', '/report/sen-carter-staff/edit')
  expect(editLinks[2]).toHaveAttribute('href', '/report/va-delegation-outreach/edit')
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
