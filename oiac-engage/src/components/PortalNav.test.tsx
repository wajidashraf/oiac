import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import PortalNav from './PortalNav'

test('exposes top-level links and expands the Activity routes', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <PortalNav />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'My Reports' })).toHaveAttribute('href', '/my-reports')
  expect(screen.getByRole('link', { name: 'My Calendar' })).toHaveAttribute('href', '/my-calendar')
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  expect(screen.getByRole('link', { name: 'Press Coverage' })).toHaveAttribute('href', '/press-coverage')

  const activityToggle = screen.getByRole('button', { name: 'Activity' })
  expect(activityToggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(activityToggle)
  expect(activityToggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Activity Log' })).toHaveAttribute('href', '/activity/activity-log')
  expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/activity/events')
  expect(screen.getByRole('link', { name: 'Appointments' })).toHaveAttribute('href', '/activity/appointments')
})

test('closes the responsive menu after navigation', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><PortalNav /></MemoryRouter>)

  const menuToggle = screen.getByRole('button', { name: 'Menu' })
  await user.click(menuToggle)
  expect(menuToggle).toHaveAttribute('aria-expanded', 'true')

  await user.click(screen.getByRole('link', { name: 'My Reports' }))
  expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
})
