import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import Appointments from './Appointments'

function renderAppointments() {
  return render(
    <MemoryRouter>
      <Appointments />
    </MemoryRouter>,
  )
}

describe('Appointments', () => {
  test('renders the approved appointment list and links completed appointments to My Reports', () => {
    renderAppointments()

    expect(screen.getByRole('heading', { name: 'Appointments', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Meeting with Sen. Miller Staff — Immigration Policy')).toBeInTheDocument()
    expect(screen.getByText('District Outreach Planning Session')).toBeInTheDocument()
    expect(screen.getByText('Advocacy Briefing — Rep. Chen Office')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Report' })).toHaveAttribute('href', '/my-reports')
    expect(screen.getByRole('button', { name: 'Join Teams' })).toBeDisabled()
    expect(document.title).toBe('Appointments — OIAC Engage')
  })

  test('opens and cancels the new appointment form above the list', async () => {
    const user = userEvent.setup()
    renderAppointments()

    expect(screen.queryByRole('form', { name: 'New Appointment' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ New Appointment' }))

    const form = screen.getByRole('form', { name: 'New Appointment' })
    expect(form).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Request Appointment', level: 2 })).toBeInTheDocument()
    expect(form.compareDocumentPosition(screen.getByRole('list', { name: 'Appointments list' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'New Appointment' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Appointment' })).toHaveFocus()
  })

  test('submits a new appointment into the list as pending', async () => {
    const user = userEvent.setup()
    renderAppointments()

    await user.click(screen.getByRole('button', { name: '+ New Appointment' }))
    await user.type(screen.getByLabelText('Appointment Title'), 'Community policy check-in')
    await user.type(screen.getByLabelText('Representative / Office'), 'Rep. Rivera Office')
    await user.type(screen.getByLabelText('Preferred Date'), '2026-10-06')
    await user.type(screen.getByLabelText('Preferred Time'), '09:30')
    await user.selectOptions(screen.getByLabelText('Status'), 'Pending')
    await user.selectOptions(screen.getByLabelText('Location / Platform'), 'OIAC DC Office')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    expect(screen.queryByRole('form', { name: 'New Appointment' })).not.toBeInTheDocument()
    expect(screen.getByText('Community policy check-in')).toBeInTheDocument()
    expect(screen.getByText('Rep. Rivera Office · Oct 6, 2026 9:30 AM')).toBeInTheDocument()
  })
})
