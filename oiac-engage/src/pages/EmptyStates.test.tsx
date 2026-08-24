import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'
import Appointments from './Appointments'
import Events from './Events'
import MyCalendar from './MyCalendar'
import MyReports from './MyReports'
import PressCoverage from './PressCoverage'

test.each([
  [<MyReports items={[]} />, 'No reports yet', 3],
  [<MyCalendar items={[]} />, 'No calendar items yet', 3],
  [<ActivityLog items={[]} />, 'No activity yet', 2],
  [<Events items={[]} />, 'No events yet', 2],
  [<Appointments items={[]} />, 'No appointments yet', 3],
  [<PressCoverage items={[]} />, 'No press coverage yet', 2],
])('renders an explicit empty state', (page, heading, level) => {
  render(page)
  expect(screen.getByRole('heading', { name: heading, level })).toBeInTheDocument()
  if (heading === 'No events yet') {
    expect(screen.queryByRole('heading', { name: 'Past events' })).not.toBeInTheDocument()
  }
})
