import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { PortalUser } from '../auth/powerPagesSession'
import PortalNav from './PortalNav'

const volunteerUser: PortalUser = {
  userName: 'volunteer@oiac.org',
  userRoles: ['Authenticated Users', 'Volunteer'],
}

test('keeps unfinished navigation visible and exposes only implemented routes as links', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <PortalNav user={volunteerUser} />
    </MemoryRouter>,
  )

  const primaryNavigation = screen.getByRole('navigation', { name: 'Primary navigation' })
  const account = screen.getByRole('group', { name: 'Account' })

  expect(within(primaryNavigation).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  expect(within(primaryNavigation).getByRole('link', { name: 'Meeting Report' })).toHaveAttribute('href', '/report')
  expect(within(primaryNavigation).getByRole('link', { name: 'My Calendar' })).toHaveAttribute('href', '/my-calendar')
  expect(within(primaryNavigation).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  expect(within(primaryNavigation).queryByRole('link', { name: /Press Coverage/ })).not.toBeInTheDocument()
  const pressCoverage = within(primaryNavigation).getByText('Press Coverage').closest<HTMLElement>('[aria-disabled="true"]')!
  expect(pressCoverage).toBeInTheDocument()
  expect(pressCoverage).toHaveClass('portal-nav__link--coming-soon')
  expect(within(pressCoverage).getByText('Coming Soon')).toBeInTheDocument()
  expect(within(account).getByRole('link', { name: 'Sign out' })).toHaveAttribute(
    'href',
    '/Account/Login/LogOff?returnUrl=%2F',
  )
  expect(within(account).getByText('Volunteer')).toBeInTheDocument()
  expect(within(primaryNavigation).queryByText('Volunteer')).not.toBeInTheDocument()
  expect(within(primaryNavigation).queryByRole('link', { name: 'Sign out' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument()

  const activityToggle = screen.getByRole('button', { name: 'Activity' })
  expect(activityToggle).toHaveAttribute('aria-expanded', 'false')
  expect(activityToggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  await user.click(activityToggle)
  expect(activityToggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByRole('link', { name: /Activity Log/ })).not.toBeInTheDocument()
  const activityLog = screen.getByText('Activity Log').closest<HTMLElement>('[aria-disabled="true"]')!
  expect(activityLog).toBeInTheDocument()
  expect(activityLog).toHaveClass('portal-nav__link--coming-soon')
  expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/activity/events')
  expect(screen.queryByRole('link', { name: /Appointments/ })).not.toBeInTheDocument()
  const appointments = screen.getByText('Appointments').closest<HTMLElement>('[aria-disabled="true"]')!
  expect(appointments).toBeInTheDocument()
  expect(appointments).toHaveClass('portal-nav__link--coming-soon')
})

test('closes the responsive menu after navigation', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><PortalNav user={volunteerUser} /></MemoryRouter>)

  const menuToggle = screen.getByRole('button', { name: 'Menu' })
  await user.click(menuToggle)
  expect(menuToggle).toHaveAttribute('aria-expanded', 'true')

  await user.click(screen.getByRole('link', { name: 'Meeting Report' }))
  expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
})

test('highlights an Activity route without forcing its submenu open', () => {
  render(
    <MemoryRouter initialEntries={['/activity/events']}>
      <PortalNav user={volunteerUser} />
    </MemoryRouter>,
  )

  const activityToggle = screen.getByRole('button', { name: 'Activity' })
  expect(activityToggle).toHaveAttribute('aria-expanded', 'false')
  expect(activityToggle).toHaveClass('portal-nav__link--active')
  expect(screen.queryByRole('link', { name: 'Activity Log' })).not.toBeInTheDocument()
})

test('closes the Activity submenu when the current nested route is selected', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/activity/events']}>
      <PortalNav user={volunteerUser} />
    </MemoryRouter>,
  )

  const activityToggle = screen.getByRole('button', { name: 'Activity' })
  await user.click(activityToggle)
  expect(activityToggle).toHaveAttribute('aria-expanded', 'true')

  await user.click(screen.getByRole('link', { name: 'Events' }))
  expect(activityToggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('link', { name: 'Events' })).not.toBeInTheDocument()
})

test('closes the Activity submenu when the user clicks outside navigation', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><PortalNav user={volunteerUser} /></MemoryRouter>)

  const activityToggle = screen.getByRole('button', { name: 'Activity' })
  await user.click(activityToggle)
  expect(activityToggle).toHaveAttribute('aria-expanded', 'true')

  await user.click(document.body)
  expect(activityToggle).toHaveAttribute('aria-expanded', 'false')
})

test('shows the functional Power Pages web role in the account zone', () => {
  const staffUser: PortalUser = {
    userName: 'staff@oiac.org',
    userRoles: ['Authenticated Users', 'Staff'],
  }
  render(<MemoryRouter><PortalNav user={staffUser} /></MemoryRouter>)

  const account = screen.getByRole('group', { name: 'Account' })
  expect(within(account).getByText('Staff')).toBeInTheDocument()
  expect(within(account).queryByText('Volunteer')).not.toBeInTheDocument()
})
