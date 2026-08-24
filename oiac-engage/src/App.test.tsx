import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from './App'

test.each([
  ['/', 'Welcome to OIAC Engage'],
  ['/my-reports', 'My Reports'],
  ['/my-calendar', 'My Calendar'],
  ['/contact', 'Contact'],
  ['/activity/activity-log', 'Activity Log'],
  ['/activity/events', 'Events'],
  ['/activity/appointments', 'Appointments'],
  ['/press-coverage', 'Press Coverage'],
  ['/activity', 'Activity Log'],
  ['/unknown', 'Page not found'],
])('renders %s as %s', (route, heading) => {
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
})

test('moves keyboard focus to the page heading after client-side navigation', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)

  await user.click(screen.getByRole('link', { name: /view my reports/i }))
  expect(screen.getByRole('heading', { name: 'My Reports', level: 1 })).toHaveFocus()
})
