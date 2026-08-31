import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import PendingApprovalShell from '../components/PendingApprovalShell'
import PendingApproval from './PendingApproval'

test('renders the approved pending-profile copy and minimal actions', () => {
  render(
    <MemoryRouter initialEntries={['/pending-approval']}>
      <PendingApprovalShell><PendingApproval /></PendingApprovalShell>
    </MemoryRouter>,
  )

  expect(screen.getByText('Approval pending')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Your profile is under review', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Thank you for creating your OIAC Engage account. Our team is reviewing your profile. We’ll notify you as soon as your access is approved.')).toBeInTheDocument()
  expect(screen.getByText('After approval, sign in again to access the portal.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'OIAC Engage pending approval' })).toHaveAttribute('href', '/pending-approval')
  expect(screen.getByRole('link', { name: 'Sign Out' })).toHaveAttribute('href', '/Account/Login/LogOff?returnUrl=%2F')
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Footer navigation' })).not.toBeInTheDocument()
})
