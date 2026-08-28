import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { ActivityItem } from '../data/portalData'
import ActivityLog from './ActivityLog'

function renderActivityLog(items?: readonly ActivityItem[]) {
  return render(
    <MemoryRouter>
      <ActivityLog items={items} />
    </MemoryRouter>,
  )
}

test('renders the activity summary and compact activity table from the reference design', () => {
  renderActivityLog()

  expect(screen.getByRole('heading', { name: 'Activity', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Submit and track your outreach activities — connected to the Volunteer Activity Table in Dataverse.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  expect(screen.getByText('1 Email')).toBeInTheDocument()
  expect(screen.getByText('1 Appointment')).toBeInTheDocument()
  expect(screen.getByText('1 Event Participation')).toBeInTheDocument()

  const table = screen.getByRole('table', { name: 'Activities' })
  expect(within(table).getAllByRole('row')).toHaveLength(4)
  expect(within(table).getByText('Outreach to Rep. Johnson office re: Iranian American issues')).toBeInTheDocument()
  expect(within(table).getByText('Aug 13, 2026')).toBeInTheDocument()
  expect(document.title).toBe('Activity — OIAC Engage')
})

test('opens the new activity form above the list and cancel closes it', async () => {
  const user = userEvent.setup()
  renderActivityLog()

  const openButton = screen.getByRole('button', { name: '+ Submit Activity' })
  expect(screen.queryByRole('form', { name: 'New Activity' })).not.toBeInTheDocument()

  await user.click(openButton)

  const form = screen.getByRole('form', { name: 'New Activity' })
  const table = screen.getByRole('table', { name: 'Activities' })
  expect(form.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText('Activity Type')).toHaveValue('Email')
  expect(screen.getByLabelText('Subject / Description')).toHaveAttribute('placeholder', 'Email subject...')
  expect(screen.getByLabelText('To (Email Address)')).toHaveAttribute('type', 'email')
  expect(openButton).toHaveAttribute('aria-expanded', 'true')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('form', { name: 'New Activity' })).not.toBeInTheDocument()
  expect(openButton).toHaveAttribute('aria-expanded', 'false')
})

test('submits a new activity and updates the derived type count', async () => {
  const user = userEvent.setup()
  renderActivityLog()

  await user.click(screen.getByRole('button', { name: '+ Submit Activity' }))
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-26' } })
  await user.type(screen.getByLabelText('Subject / Description'), 'Follow-up with Rep. Johnson staff')
  await user.type(screen.getByLabelText('To (Email Address)'), 'office@sen.johnson.gov')
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  const table = screen.getByRole('table', { name: 'Activities' })
  expect(within(table).getByText('Follow-up with Rep. Johnson staff')).toBeInTheDocument()
  expect(screen.getByText('2 Emails')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Activity submitted.')
  expect(screen.queryByRole('form', { name: 'New Activity' })).not.toBeInTheDocument()
})

test('shows inert View actions for submitted emails, confirmed appointments, and completed participation', async () => {
  const user = userEvent.setup()
  renderActivityLog()

  expect(screen.getByRole('button', { name: 'View Outreach to Rep. Johnson office re: Iranian American issues' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View Meeting with Sen. Carter staff — immigration policy' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View Participated in Community Forum — Chicago' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'View Outreach to Rep. Johnson office re: Iranian American issues' }))
  expect(screen.queryByRole('form', { name: 'Edit Activity' })).not.toBeInTheDocument()
})

test('edit opens the same inline form with the selected activity and saves changes', async () => {
  const user = userEvent.setup()
  renderActivityLog([{
    id: 'activity-editable',
    type: 'Email',
    subject: 'Draft congressional outreach',
    date: '2026-08-13',
    status: 'Confirmed',
    contact: 'office@sen.johnson.gov',
    notes: '',
  }])

  await user.click(screen.getByRole('button', {
    name: 'Edit Draft congressional outreach',
  }))

  expect(screen.getByRole('form', { name: 'Edit Activity' })).toBeInTheDocument()
  expect(screen.getByLabelText('Activity Type')).toHaveValue('Email')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-08-13')
  expect(screen.getByLabelText('Subject / Description')).toHaveValue('Draft congressional outreach')

  await user.clear(screen.getByLabelText('Subject / Description'))
  await user.type(screen.getByLabelText('Subject / Description'), 'Updated congressional outreach')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))

  expect(screen.getByRole('table', { name: 'Activities' })).toHaveTextContent('Updated congressional outreach')
  expect(screen.getByRole('status')).toHaveTextContent('Activity updated.')
})
