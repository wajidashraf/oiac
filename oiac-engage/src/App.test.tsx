import { render, screen } from '@testing-library/react'
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
