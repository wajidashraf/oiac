import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { AuthSession } from './auth/powerPagesSession'

const authenticatedSession: AuthSession = {
  status: 'authenticated',
  user: {
    userName: 'member@oiac.org',
    firstName: 'OIAC',
    lastName: 'Member',
    contactId: '11111111-1111-4111-8111-111111111111',
    userRoles: ['Authenticated Users', 'Volunteer'],
  },
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

function renderApp(
  route: string,
  session: AuthSession = authenticatedSession,
  navigate = vi.fn(),
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App session={session} navigate={navigate} />
      <LocationProbe />
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
  ['/activity/activity-log', 'Page not found'],
  ['/activity/events', 'Events'],
  ['/activity/appointments', 'Page not found'],
  ['/press-coverage', 'Page not found'],
  ['/activity', 'Events'],
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

test.each([
  ['no assigned roles', []],
  ['only the authenticated implicit role', ['Authenticated Users']],
  ['both implicit roles', ['Anonymous Users', 'Authenticated Users']],
])('gates a signed-in profile with %s', async (_label, userRoles) => {
  renderApp('/report', {
    status: 'authenticated',
    user: { userName: 'pending@oiac.org', userRoles },
  })

  expect(screen.getByRole('heading', { name: 'Your profile is under review', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign Out' })).toHaveAttribute(
    'href',
    '/Account/Login/LogOff?returnUrl=%2F',
  )
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Meeting Reports' })).not.toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByTestId('current-path')).toHaveTextContent('/pending-approval')
  })
})

test('allows an authenticated profile with any assigned custom role into the portal', () => {
  renderApp('/resources', {
    status: 'authenticated',
    user: {
      userName: 'coordinator@oiac.org',
      userRoles: ['Authenticated Users', 'Regional Coordinator'],
    },
  })

  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
  expect(screen.getByTestId('current-path')).toHaveTextContent('/resources')
})
