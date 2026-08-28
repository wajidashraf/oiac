import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import Contact from './Contact'

function renderContact() {
  return render(<MemoryRouter><Contact /></MemoryRouter>)
}

test('renders the district contact directory from the reference design', () => {
  renderContact()

  expect(screen.getByRole('heading', { name: 'Contacts', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Showing contacts in your district — Washington, DC & Virginia.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('searchbox', { name: 'Search contacts' })).toHaveAttribute(
    'placeholder',
    'Search by name, state, or city...',
  )

  const table = screen.getByRole('table', { name: 'District contacts' })
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  expect(within(table).getByRole('rowheader', { name: 'Sara Rahimi' })).toBeInTheDocument()
  expect(within(table).getByText('+1 (202) 555-0142')).toBeInTheDocument()
  expect(within(table).getByText('sara.rahimi@oiac.org')).toBeInTheDocument()
  expect(within(table).getByText('Washington')).toBeInTheDocument()
  expect(document.title).toBe('Contacts — OIAC Engage')
})

test('filters contacts by name, state, or city and explains an empty result', async () => {
  const user = userEvent.setup()
  renderContact()

  const search = screen.getByRole('searchbox', { name: 'Search contacts' })
  await user.type(search, 'Arlington')
  expect(screen.queryByText('Sara Rahimi')).not.toBeInTheDocument()
  expect(screen.getByText('Reza Ahmadi')).toBeInTheDocument()

  await user.clear(search)
  await user.type(search, 'Maryland')
  expect(screen.getByRole('status')).toHaveTextContent('No contacts found')
})

test('provides direct phone and email actions for each contact', () => {
  renderContact()

  expect(screen.getByRole('link', { name: 'Call Sara Rahimi' })).toHaveAttribute('href', 'tel:+12025550142')
  expect(screen.getByRole('link', { name: 'Email Sara Rahimi' })).toHaveAttribute('href', 'mailto:sara.rahimi@oiac.org')
})

test('opens read-only contact details above the list and closes them', async () => {
  const user = userEvent.setup()
  renderContact()

  await user.click(screen.getByRole('button', { name: 'View Sara Rahimi contact' }))

  const details = screen.getByRole('form', { name: 'Contact details for Sara Rahimi' })
  const table = screen.getByRole('table', { name: 'District contacts' })
  expect(details.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(details).getByLabelText('Full Name')).toHaveValue('Sara Rahimi')
  expect(within(details).getByLabelText('Mobile Phone')).toHaveValue('+1 (202) 555-0142')
  expect(within(details).getByLabelText('Email')).toHaveValue('sara.rahimi@oiac.org')
  expect(within(details).getByLabelText('State')).toHaveValue('DC')
  expect(within(details).getByLabelText('City')).toHaveValue('Washington')
  expect(within(details).getAllByRole('textbox').every((field) => field.hasAttribute('readonly'))).toBe(true)
  expect(screen.queryByRole('link', { name: 'Call Sara Rahimi from contact details' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Email Sara Rahimi from contact details' })).not.toBeInTheDocument()

  await user.click(within(details).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('form', { name: 'Contact details for Sara Rahimi' })).not.toBeInTheDocument()
})
