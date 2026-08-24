import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import Home from './Home'

test('gives members shortcuts and an activity overview', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Welcome to OIAC Engage' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /view my reports/i })).toHaveAttribute('href', '/my-reports')
  expect(screen.getByRole('link', { name: /open my calendar/i })).toHaveAttribute('href', '/my-calendar')
  expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument()
  expect(document.title).toBe('OIAC Engage')
})

test('offers entry points for the existing audience and each requested role', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Ways to participate' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Member/ })).toHaveAttribute('href', '/my-reports')
  expect(screen.getByRole('link', { name: /Volunteer/ })).toHaveAttribute('href', '/activity/activity-log')
  expect(screen.getByRole('link', { name: /Staff/ })).toHaveAttribute('href', '/activity/appointments')
  expect(screen.getByRole('link', { name: /Applicant/ })).toHaveAttribute('href', '/contact')
})
