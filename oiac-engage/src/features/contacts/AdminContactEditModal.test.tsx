import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { searchDistricts } from '../meetingReports/meetingReportService'
import { updateAdminContact } from './contactService'
import type { DistrictContact } from './contactTypes'
import { AdminContactEditModal } from './AdminContactEditModal'

vi.mock('./contactService', () => ({
  updateAdminContact: vi.fn(),
}))

vi.mock('../meetingReports/meetingReportService', () => ({
  searchContacts: vi.fn(),
  searchDistricts: vi.fn(),
}))

const updateAdminContactMock = vi.mocked(updateAdminContact)
const searchDistrictsMock = vi.mocked(searchDistricts)
const CONTACT_ID = '20f9c936-6740-451e-9470-28a3c83c9909'
const DISTRICT_ID = '367d7420-d8a2-f111-b8da-7ced8d70f293'
const NEW_DISTRICT_ID = '11111111-2222-4333-8444-555555555555'

const contact: DistrictContact = {
  id: CONTACT_ID,
  fullName: 'Sara Rahimi',
  firstName: 'Sara',
  lastName: 'Rahimi',
  email: 'sara@example.org',
  jobTitle: 'Volunteer Coordinator',
  mobilePhone: '202-555-0100',
  city: 'Washington',
  stateOrProvince: 'DC',
  postalCode: '20001',
  districtName: 'District 1',
  districtId: DISTRICT_ID,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderModal(overrides: Partial<React.ComponentProps<typeof AdminContactEditModal>> = {}) {
  return render(
    <AdminContactEditModal
      contact={contact}
      returnFocusTo={null}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  updateAdminContactMock.mockReset()
  searchDistrictsMock.mockReset()
  updateAdminContactMock.mockResolvedValue(undefined)
  searchDistrictsMock.mockResolvedValue([
    { id: NEW_DISTRICT_ID, name: 'District 2' },
  ])
})

afterEach(() => {
  document.body.style.overflow = ''
  vi.useRealTimers()
})

describe('AdminContactEditModal', () => {
  test('renders approved editable fields while keeping email read-only', () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: 'Edit volunteer contact' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Edit volunteer contact' })).toBeInTheDocument()
    expect(screen.getByLabelText('First Name')).toHaveValue('Sara')
    expect(screen.getByLabelText('Last Name')).toHaveValue('Rahimi')
    expect(screen.getByLabelText('Last Name')).toBeRequired()
    expect(screen.getByLabelText('Job Title')).toHaveValue('Volunteer Coordinator')
    expect(screen.getByLabelText('Mobile Phone')).toHaveValue('202-555-0100')
    expect(screen.getByLabelText('City')).toHaveValue('Washington')
    expect(screen.getByLabelText('State / Province')).toHaveValue('DC')
    expect(screen.getByLabelText('Postal Code')).toHaveValue('20001')
    expect(screen.getByLabelText('Email')).toHaveValue('sara@example.org')
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Email')).toBeEnabled()
    expect(screen.queryByLabelText('Contact ID')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument()
    expect(screen.getByText('District 1')).toBeInTheDocument()
  })

  test('searches, replaces, and clears the District selection', async () => {
    const actor = userEvent.setup()
    renderModal()

    const districtSearch = screen.getByRole('combobox', { name: 'District' })
    await actor.type(districtSearch, 'District 2')
    expect(await screen.findByRole('option', { name: 'District 2' })).toBeInTheDocument()
    expect(searchDistrictsMock).toHaveBeenLastCalledWith('District 2', expect.any(AbortSignal))

    await actor.click(screen.getByRole('option', { name: 'District 2' }))
    expect(screen.getByText('District 2')).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Clear District' }))
    expect(screen.queryByText('District 2')).not.toBeInTheDocument()
  })

  test('submits only approved values and locks every dismissal path while saving', async () => {
    const actor = userEvent.setup()
    const pending = deferred<void>()
    const onClose = vi.fn()
    const onSaved = vi.fn()
    updateAdminContactMock.mockReturnValue(pending.promise)
    const { container } = renderModal({ onClose, onSaved })

    await actor.clear(screen.getByLabelText('First Name'))
    await actor.type(screen.getByLabelText('First Name'), 'Amina')
    await actor.clear(screen.getByLabelText('Mobile Phone'))
    await actor.clear(screen.getByLabelText('City'))
    await actor.type(screen.getByLabelText('City'), 'Alexandria')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateAdminContactMock).toHaveBeenCalledWith(CONTACT_ID, {
      firstName: 'Amina',
      lastName: 'Rahimi',
      jobTitle: 'Volunteer Coordinator',
      mobilePhone: '',
      city: 'Alexandria',
      stateOrProvince: 'DC',
      postalCode: '20001',
      districtId: DISTRICT_ID,
    })
    expect(updateAdminContactMock.mock.calls[0]?.[1]).not.toHaveProperty('email')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close edit contact' })).toBeDisabled()

    const form = screen.getByRole('form', { name: 'Edit volunteer contact' })
    fireEvent.submit(form)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.admin-contact-modal')!)
    expect(updateAdminContactMock).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    pending.resolve()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  test('validates Last Name and keeps a failed save open with a safe error', async () => {
    const actor = userEvent.setup()
    const onSaved = vi.fn()
    renderModal({ onSaved })

    await actor.clear(screen.getByLabelText('Last Name'))
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Last Name is required.')
    expect(updateAdminContactMock).not.toHaveBeenCalled()

    await actor.type(screen.getByLabelText('Last Name'), 'Rahimi')
    updateAdminContactMock.mockRejectedValueOnce(new Error('Dataverse detail'))
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Contact changes could not be saved. Try again.',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('closes only while idle, traps focus, locks scrolling, and restores focus on cleanup', async () => {
    const actor = userEvent.setup()
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    trigger.textContent = 'Edit Sara'
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'auto'
    const { container, unmount } = renderModal({ onClose, returnFocusTo: trigger })

    const close = screen.getByRole('button', { name: 'Close edit contact' })
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await actor.tab({ shift: true })
    expect(save).toHaveFocus()
    await actor.tab()
    expect(close).toHaveFocus()

    await actor.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('.admin-contact-modal')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
