import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { AuthSession } from './auth/powerPagesSession'

const authenticatedSession: AuthSession = {
  status: 'authenticated',
  user: {
    userName: 'member@oiac.org',
    firstName: 'OIAC',
    lastName: 'Member',
    userRoles: ['Authenticated Users', 'Volunteer'],
  },
}

function renderApp(
  route: string,
  session: AuthSession = authenticatedSession,
  navigate = vi.fn(),
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App session={session} navigate={navigate} />
    </MemoryRouter>,
  )
}

test.each([
  ['/', 'Volunteer'],
  ['/report', 'Meeting Reports'],
  ['/report/new', 'Meeting Reports'],
  ['/report/advocacy-briefing-chen/edit', 'Meeting Reports'],
  ['/my-reports', 'My Reports'],
  ['/my-calendar', 'My Calendar'],
  ['/contact', 'Contacts'],
  ['/activity/activity-log', 'Activity'],
  ['/activity/events', 'Events'],
  ['/activity/appointments', 'Appointments'],
  ['/press-coverage', 'Press Coverage'],
  ['/activity', 'Activity'],
  ['/unknown', 'Page not found'],
])('renders %s as %s', (route, heading) => {
  renderApp(route)
  expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
})

test('moves keyboard focus to the page heading after client-side navigation', async () => {
  const user = userEvent.setup()
  renderApp('/')

  await user.click(screen.getByRole('link', { name: '+ Submit Report' }))
  expect(screen.getByRole('heading', { name: 'Meeting Reports', level: 1 })).toHaveFocus()
})

test('keeps the skip link as the first tab stop on initial load', async () => {
  const user = userEvent.setup()
  renderApp('/')

  expect(document.body).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
})

test('renders the authenticated footer links from the portal reference', () => {
  renderApp('/contact')

  const footer = screen.getByRole('contentinfo')
  expect(within(footer).getByText('Organization of Iranian American Communities — U.S.')).toBeInTheDocument()
  expect(within(footer).getByRole('link', { name: 'oiac.org' })).toHaveAttribute('href', 'https://oiac.org')
  expect(within(footer).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources')
  expect(within(footer).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
})

test('aligns the header, page content, and footer inside the shared site container', () => {
  renderApp('/contact')

  expect(document.querySelector('.site-header')?.firstElementChild).toHaveClass('site-container')
  expect(screen.getByRole('main').firstElementChild).toHaveClass('site-container')
  expect(screen.getByRole('contentinfo').firstElementChild).toHaveClass('site-container')
})

test.each([
  '/',
  '/my-reports',
  '/resources',
  '/report',
  '/press-coverage',
  '/activity/appointments',
])('shows only the anonymous welcome experience at %s without a session', (route) => {
  const navigate = vi.fn()
  renderApp(route, { status: 'anonymous' }, navigate)

  expect(screen.getByRole('heading', { name: 'OIAC Engage', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign In to Get Started' })).toHaveAttribute(
    'href',
    '/SignIn?returnUrl=%2F',
  )
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'My Reports' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Meeting Reports' })).not.toBeInTheDocument()
  expect(navigate).not.toHaveBeenCalled()
})

test('renders Resources only for an authenticated session', () => {
  renderApp('/resources')

  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  const primaryNavigation = screen.getByRole('navigation', { name: 'Primary navigation' })
  expect(within(primaryNavigation).queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument()
})
