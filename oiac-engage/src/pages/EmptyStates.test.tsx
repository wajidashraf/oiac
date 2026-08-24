import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'
import Appointments from './Appointments'
import Events from './Events'
import MyCalendar from './MyCalendar'
import MyReports from './MyReports'
import PressCoverage from './PressCoverage'

test.each([
  [<MyReports items={[]} />, 'No reports yet'],
  [<MyCalendar items={[]} />, 'No calendar items yet'],
  [<ActivityLog items={[]} />, 'No activity yet'],
  [<Events items={[]} />, 'No events yet'],
  [<Appointments items={[]} />, 'No appointments yet'],
  [<PressCoverage items={[]} />, 'No press coverage yet'],
])('renders an explicit empty state', (page, heading) => {
  render(page)
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
})
