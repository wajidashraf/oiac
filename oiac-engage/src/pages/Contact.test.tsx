import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PortalUser } from '../auth/powerPagesSession'
import type { DistrictContactsState } from '../features/contacts/useDistrictContacts'
import { useDistrictContacts } from '../features/contacts/useDistrictContacts'
import Contact from './Contact'

vi.mock('../features/contacts/useDistrictContacts', () => ({
  useDistrictContacts: vi.fn(),
}))

const useDistrictContactsMock = vi.mocked(useDistrictContacts)
const setSearch = vi.fn()
const nextPage = vi.fn()
const previousPage = vi.fn()
const retry = vi.fn()
const user: PortalUser = {
  userName: 'member@oiac.org',
  contactId: '20f9c936-6740-451e-9470-28a3c83c9909',
  userRoles: ['Authenticated Users'],
}

const readyState: DistrictContactsState = {
  contacts: [{
    id: '10000000-0000-0000-0000-000000000001',
    fullName: 'Sara Rahimi',
    email: 'sara.rahimi@oiac.org',
    mobilePhone: '+1 (202) 555-0142',
    city: 'Washington',
    districtName: 'District 1',
    districtId: '367d7420-d8a2-f111-b8da-7ced8d70f293',
  }],
  search: '',
  setSearch,
  page: 1,
  hasNext: true,
  isLoading: false,
  status: 'ready',
  errorMessage: null,
  nextPage,
  previousPage,
  retry,
}

function renderContact() {
  return render(<MemoryRouter><Contact user={user} /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useDistrictContactsMock.mockReturnValue(readyState)
})

test('renders a district Contact table without record actions or record links', () => {
  renderContact()

  expect(useDistrictContactsMock).toHaveBeenCalledWith(user.contactId)
  expect(screen.getByRole('heading', { name: 'Contacts', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Contacts assigned to your district.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')

  const table = screen.getByRole('table', { name: 'District contacts' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Full Name',
    'Mobile Phone',
    'Email',
    'District',
    'City',
  ])
  expect(within(table).getByRole('rowheader', { name: 'Sara Rahimi' })).toBeInTheDocument()
  expect(within(table).getByText('District 1')).toBeInTheDocument()
  expect(within(table).queryByRole('button', { name: /View/i })).not.toBeInTheDocument()
  expect(within(table).queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: /Contact details/i })).not.toBeInTheDocument()
})

test('shows missing values as em dashes without failing the row', () => {
  useDistrictContactsMock.mockReturnValue({
    ...readyState,
    contacts: [{
      id: '10000000-0000-0000-0000-000000000002',
      fullName: null,
      email: null,
      mobilePhone: null,
      city: null,
      districtName: null,
      districtId: '367d7420-d8a2-f111-b8da-7ced8d70f293',
    }],
  })
  renderContact()

  const table = screen.getByRole('table', { name: 'District contacts' })
  expect(within(table).getAllByText('—')).toHaveLength(5)
})

test('passes search text to the debounced directory state', async () => {
  renderContact()

  const search = screen.getByRole('searchbox', { name: 'Search contacts' })
  expect(search).toHaveAttribute('placeholder', 'Search by name, email, phone, or city...')
  fireEvent.change(search, { target: { value: 'Sara' } })

  expect(setSearch).toHaveBeenCalledWith('Sara')
})

test('renders page controls and respects first, last, and loading boundaries', async () => {
  const interaction = userEvent.setup()
  const { rerender } = renderContact()

  expect(screen.getByText('Page 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  await interaction.click(screen.getByRole('button', { name: 'Next page' }))
  expect(nextPage).toHaveBeenCalledTimes(1)

  useDistrictContactsMock.mockReturnValue({ ...readyState, page: 2, hasNext: false, isLoading: true, status: 'loading-contacts' })
  rerender(<MemoryRouter><Contact user={user} /></MemoryRouter>)
  expect(screen.getByText('Page 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test.each([
  ['loading-district', 'Loading your district…'],
  ['loading-contacts', 'Loading contacts…'],
  ['missing-session', 'Your Power Pages session could not identify your Contact. Sign in again to continue.'],
  ['missing-district', 'No district is assigned to your profile. Contact an administrator to update your district.'],
] as const)('renders the %s state', (status, message) => {
  useDistrictContactsMock.mockReturnValue({
    ...readyState,
    contacts: [],
    hasNext: false,
    isLoading: status.startsWith('loading'),
    status,
  })

  renderContact()

  expect(screen.getByRole('status')).toHaveTextContent(message)
  expect(screen.queryByRole('table', { name: 'District contacts' })).not.toBeInTheDocument()
})

test('distinguishes an empty district from a search with no matches', () => {
  useDistrictContactsMock.mockReturnValue({ ...readyState, contacts: [], hasNext: false })
  const { rerender } = renderContact()
  expect(screen.getByRole('status')).toHaveTextContent('No contacts are available in your district.')

  useDistrictContactsMock.mockReturnValue({ ...readyState, contacts: [], search: 'Nobody', hasNext: false })
  rerender(<MemoryRouter><Contact user={user} /></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('No contacts match “Nobody”.')
})

test('renders a non-sensitive error and retries the current request', async () => {
  const interaction = userEvent.setup()
  useDistrictContactsMock.mockReturnValue({
    ...readyState,
    contacts: [],
    hasNext: false,
    status: 'error',
    errorMessage: 'Contacts could not be loaded. Try again.',
  })
  renderContact()

  expect(screen.getByRole('alert')).toHaveTextContent('Contacts could not be loaded. Try again.')
  await interaction.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledTimes(1)
})
