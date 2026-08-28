import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import PressCoverage from './PressCoverage'

function renderPressCoverage() {
  return render(
    <MemoryRouter>
      <PressCoverage />
    </MemoryRouter>,
  )
}

test('renders the press coverage table from the reference design', () => {
  renderPressCoverage()

  expect(screen.getByRole('heading', { name: 'Press Coverage', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Log and track media coverage related to OIAC activities and advocacy.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')

  const table = screen.getByRole('table', { name: 'Press coverage' })
  expect(within(table).getAllByRole('row')).toHaveLength(4)
  expect(within(table).getByRole('rowheader', {
    name: 'Iranian Americans Advocate for Sanctions Relief on Capitol Hill',
  })).toBeInTheDocument()
  expect(within(table).getByText('Aug 12, 2026')).toBeInTheDocument()
  expect(within(table).getAllByText('Positive')).toHaveLength(2)
  expect(document.title).toBe('Press Coverage — OIAC Engage')
})

test('opens the add form above the list and cancel closes it', async () => {
  const user = userEvent.setup()
  renderPressCoverage()

  const addButton = screen.getByRole('button', { name: '+ Add Press Coverage' })
  expect(screen.queryByRole('form', { name: 'Press Coverage' })).not.toBeInTheDocument()

  await user.click(addButton)

  const form = screen.getByRole('form', { name: 'Press Coverage' })
  const table = screen.getByRole('table', { name: 'Press coverage' })
  expect(form.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText('News Title')).toHaveAttribute('placeholder', 'Article or segment title')
  expect(screen.getByLabelText('Country')).toHaveValue('United States')
  expect(addButton).toHaveAttribute('aria-expanded', 'true')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('form', { name: 'Press Coverage' })).not.toBeInTheDocument()
  expect(addButton).toHaveAttribute('aria-expanded', 'false')
})

test('edit opens the inline form with the selected coverage prefilled', async () => {
  const user = userEvent.setup()
  renderPressCoverage()

  await user.click(screen.getByRole('button', {
    name: 'Edit Iranian Americans Advocate for Sanctions Relief on Capitol Hill',
  }))

  expect(screen.getByRole('form', { name: 'Press Coverage' })).toBeInTheDocument()
  expect(screen.getByLabelText('News Title')).toHaveValue(
    'Iranian Americans Advocate for Sanctions Relief on Capitol Hill',
  )
  expect(screen.getByLabelText('Date')).toHaveValue('2026-08-12')
  expect(screen.getByLabelText('News Source Type')).toHaveValue('National')
  expect(screen.getByLabelText('Coverage Type')).toHaveValue('News Article')
})

test('saves a new coverage record into the local table', async () => {
  const user = userEvent.setup()
  renderPressCoverage()

  await user.click(screen.getByRole('button', { name: '+ Add Press Coverage' }))
  await user.type(screen.getByLabelText('News Title'), 'OIAC volunteers brief local media')
  await user.type(screen.getByLabelText('Date'), '2026-08-25')
  await user.selectOptions(screen.getByLabelText('News Source Type'), 'Local')
  await user.selectOptions(screen.getByLabelText('Sentiment'), 'Positive')
  await user.selectOptions(screen.getByLabelText('Coverage Type'), 'Interview')
  await user.click(screen.getByRole('button', { name: 'Save Coverage' }))

  const table = screen.getByRole('table', { name: 'Press coverage' })
  expect(within(table).getByRole('rowheader', { name: 'OIAC volunteers brief local media' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Press coverage saved.')
  expect(screen.queryByRole('form', { name: 'Press Coverage' })).not.toBeInTheDocument()
})
