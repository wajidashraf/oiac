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
  [
    <MemoryRouter>
      <MyCalendar
        contactId="11111111-1111-4111-8111-111111111111"
        acceptedItems={[]}
        initialMonth={new Date(2026, 8, 1)}
        loadRegistrations={() => Promise.resolve([])}
      />
    </MemoryRouter>,
    'No registered events yet',
    2,
  ],
  [<ActivityLog items={[]} />, 'No activity yet', 2],
  [<MemoryRouter><Appointments items={[]} /></MemoryRouter>, 'No appointments yet', 2],
  [<PressCoverage items={[]} />, 'No press coverage yet', 2],
])('renders an explicit empty state', async (page, heading, level) => {
  render(page)
  expect(await screen.findByRole('heading', { name: heading, level })).toBeInTheDocument()
})

test('renders an explicit Events empty state after loading', async () => {
  render(
    <MemoryRouter>
      <Events isAdmin={false} loadEvents={() => Promise.resolve([])} />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'No events available', level: 2 })).toBeInTheDocument()
})
