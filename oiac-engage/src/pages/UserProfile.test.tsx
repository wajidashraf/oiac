import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PortalUser } from '../auth/powerPagesSession'
import { powerPagesFetch } from '../shared/powerPagesApi'
import UserProfile from './UserProfile'

vi.mock('../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
}))

const powerPagesFetchMock = vi.mocked(powerPagesFetch)
const CONTACT_ID = '11111111-1111-4111-8111-111111111111'
const approvedUser: PortalUser = {
  userName: 'ava@example.org',
  firstName: 'Ava',
  lastName: 'Rahimi',
  contactId: CONTACT_ID,
  userRoles: ['Authenticated Users', 'Volunteer'],
}
const profileRecord = {
  contactid: CONTACT_ID,
  firstname: 'Ava',
  lastname: 'Rahimi',
  address1_city: 'Arlington',
  address1_stateorprovince: 'Virginia',
}

function renderProfile(user: PortalUser = approvedUser) {
  return render(
    <MemoryRouter>
      <UserProfile user={user} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  powerPagesFetchMock.mockReset()
})

test('loads the current Contact into the profile form without displaying email', async () => {
  let resolveProfile!: (value: typeof profileRecord) => void
  powerPagesFetchMock.mockReturnValue(new Promise((resolve) => {
    resolveProfile = resolve
  }))

  renderProfile()
  expect(screen.getByRole('status')).toHaveTextContent('Loading your profile')

  resolveProfile(profileRecord)
  expect(await screen.findByLabelText(/^First Name/)).toHaveValue('Ava')
  expect(screen.getByLabelText(/^Last Name/)).toHaveValue('Rahimi')
  expect(screen.getByLabelText('City')).toHaveValue('Arlington')
  expect(screen.getByLabelText('State')).toHaveValue('Virginia')
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  expect(screen.queryByText('ava@example.org')).not.toBeInTheDocument()
})

test('does not request Dataverse when the session has no valid Contact identifier', () => {
  renderProfile({
    userName: 'missing@example.org',
    contactId: 'not-a-guid',
    userRoles: ['Authenticated Users', 'Volunteer'],
  })

  expect(screen.getByRole('status')).toHaveTextContent(
    'Your Power Pages session could not identify your Contact. Sign in again to continue.',
  )
  expect(powerPagesFetchMock).not.toHaveBeenCalled()
})

test('retries a failed profile load', async () => {
  const user = userEvent.setup()
  powerPagesFetchMock
    .mockRejectedValueOnce(new Error('Dataverse detail'))
    .mockResolvedValueOnce(profileRecord)

  renderProfile()
  expect(await screen.findByRole('alert')).toHaveTextContent('Your profile could not be loaded.')

  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText(/^First Name/)).toHaveValue('Ava')
  expect(powerPagesFetchMock).toHaveBeenCalledTimes(2)
})

test('requires both name fields and focuses the first invalid field', async () => {
  const user = userEvent.setup()
  powerPagesFetchMock.mockResolvedValue(profileRecord)
  renderProfile()

  const firstName = await screen.findByLabelText(/^First Name/)
  await user.clear(firstName)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Enter your first and last name.')
  expect(firstName).toHaveFocus()
  expect(powerPagesFetchMock).toHaveBeenCalledTimes(1)
})

test('saves the four profile values and announces success', async () => {
  const user = userEvent.setup()
  powerPagesFetchMock
    .mockResolvedValueOnce(profileRecord)
    .mockResolvedValueOnce(undefined)
  renderProfile()

  const city = await screen.findByLabelText('City')
  await user.clear(city)
  await user.type(city, 'Alexandria')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Profile updated.')
  expect(city).toHaveValue('Alexandria')
  expect(powerPagesFetchMock).toHaveBeenCalledTimes(2)
})

test('keeps entered values when the profile update fails', async () => {
  const user = userEvent.setup()
  powerPagesFetchMock
    .mockResolvedValueOnce(profileRecord)
    .mockRejectedValueOnce(new Error('Dataverse detail'))
  renderProfile()

  const state = await screen.findByLabelText('State')
  await user.clear(state)
  await user.type(state, 'Maryland')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your profile could not be updated. Try again.',
  )
  expect(state).toHaveValue('Maryland')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled())
})
