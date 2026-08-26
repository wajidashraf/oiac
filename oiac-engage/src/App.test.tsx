import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { AuthSession } from './auth/powerPagesSession'

const authenticatedSession: AuthSession = {
  status: 'authenticated',
  user: { userName: 'member@oiac.org', firstName: 'OIAC', lastName: 'Member' },
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
  renderApp(route)
  expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
})

test('moves keyboard focus to the page heading after client-side navigation', async () => {
  const user = userEvent.setup()
  renderApp('/')

  await user.click(screen.getByRole('link', { name: /view my reports/i }))
  expect(screen.getByRole('heading', { name: 'My Reports', level: 1 })).toHaveFocus()
})

test('keeps the skip link as the first tab stop on initial load', async () => {
  const user = userEvent.setup()
  renderApp('/')

  expect(document.body).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
})

test('shows only the public experience to anonymous visitors', () => {
  renderApp('/', { status: 'anonymous' })

  expect(screen.getByRole('heading', { name: 'OIAC Engage', level: 1 })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /sign in/i })).toHaveLength(2)
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByText('My Reports')).not.toBeInTheDocument()
})

test('redirects an anonymous protected route with its return URL', async () => {
  const navigate = vi.fn()
  renderApp('/my-reports', { status: 'anonymous' }, navigate)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/SignIn?returnUrl=%2Fmy-reports')
  })
  expect(screen.queryByRole('heading', { name: 'My Reports' })).not.toBeInTheDocument()
})

test('renders Resources only for an authenticated session', () => {
  renderApp('/resources')

  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument()
})

test('redirects anonymous Resources access to sign in', async () => {
  const navigate = vi.fn()
  renderApp('/resources', { status: 'anonymous' }, navigate)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/SignIn?returnUrl=%2Fresources')
  })
})
