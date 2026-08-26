import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
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

test('routes submit and every report edit action to the shared report page', () => {
  renderHome()

  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report')
  const editLinks = screen.getAllByRole('link', { name: /^Edit / })
  expect(editLinks).toHaveLength(3)
  editLinks.forEach((link) => expect(link).toHaveAttribute('href', '/report'))
})
