import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'
import Appointments from './Appointments'
import Events from './Events'
import MyCalendar from './MyCalendar'
import MyReports from './MyReports'
import PressCoverage from './PressCoverage'

test.each([
  [<MyReports items={[]} />, 'No reports yet', 3],
  [<MemoryRouter><MyCalendar items={[]} initialMonth={new Date(2026, 8, 1)} /></MemoryRouter>, 'No upcoming items this month', 3],
  [<ActivityLog items={[]} />, 'No activity yet', 2],
  [<MemoryRouter><Events items={[]} /></MemoryRouter>, 'No events yet', 2],
  [<MemoryRouter><Appointments items={[]} /></MemoryRouter>, 'No appointments yet', 2],
  [<PressCoverage items={[]} />, 'No press coverage yet', 2],
])('renders an explicit empty state', (page, heading, level) => {
  render(page)
  expect(screen.getByRole('heading', { name: heading, level })).toBeInTheDocument()
})
