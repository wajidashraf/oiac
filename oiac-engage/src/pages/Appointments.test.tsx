import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Appointments from './Appointments'
import * as service from '../features/appointments/appointmentService'
import type { AppointmentRecord } from '../features/appointments/appointmentTypes'

vi.mock('../features/appointments/appointmentService', () => ({
  getAppointmentPage: vi.fn(), searchAppointmentContacts: vi.fn(), createAppointment: vi.fn(), acceptAppointment: vi.fn(), rescheduleAppointment: vi.fn(),
  AppointmentSaveUncertainError: class extends Error {}, AppointmentConflictError: class extends Error {},
}))
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice Adams' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob Brown' }
const pending: AppointmentRecord = { id: '33333333-3333-4333-8333-333333333333', title: 'Policy discussion', status: 866530000, statusLabel: 'Pending', meetingFormat: 1, meetingFormatLabel: 'Microsoft Teams', preferredDateTime: '2026-10-20T13:30:00Z', suggestedDateTime: null, agenda: 'Community priorities', meetingLink: null, reschedulingReason: '', requester: alice, recipient: bob, rowVersion: '123' }
let incoming: AppointmentRecord[]
let outgoing: AppointmentRecord[]
beforeEach(() => {
  incoming = [pending, { ...pending, id: '44444444-4444-4444-8444-444444444444', title: 'Outreach planning', meetingFormat: 2, meetingFormatLabel: 'Phone Call' }]
  outgoing = [{ ...pending, id: '55555555-5555-4555-8555-555555555555', title: 'Sent request', requester: bob, recipient: alice }]
  vi.mocked(service.getAppointmentPage).mockImplementation(async (view) => ({ appointments: view === 'incoming' ? incoming : outgoing, awaitingCount: view === 'incoming' ? 2 : 0, nextLink: null }))
  vi.mocked(service.searchAppointmentContacts).mockResolvedValue([{ ...alice, email: null, jobTitle: null }, { ...bob, email: null, jobTitle: null }])
  vi.mocked(service.createAppointment).mockResolvedValue({ id: pending.id })
  vi.mocked(service.acceptAppointment).mockResolvedValue({ id: pending.id })
  vi.mocked(service.rescheduleAppointment).mockResolvedValue({ id: pending.id })
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); sessionStorage.clear() })
function show(props: { contactId?: string; isAdmin?: boolean; canCreate?: boolean } = { contactId: bob.id }) { return render(<MemoryRouter><Appointments {...props} /></MemoryRouter>) }
async function openRequest() { const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: '+ New Appointment' })); return user }
async function fillRequest(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Appointment Title'), 'New discussion')
  await user.click(screen.getByRole('combobox', { name: 'Contact' }))
  await user.click(await screen.findByRole('option', { name: 'Alice Adams' }))
  await user.selectOptions(screen.getByLabelText('Meeting Format'), '2')
  fireEvent.change(screen.getByLabelText('Preferred Date'), { target: { value: '2026-10-21' } })
  fireEvent.change(screen.getByLabelText('Preferred Time (Eastern Time)'), { target: { value: '09:30' } })
}

test('separates incoming requests from outgoing requests in that order', async () => {
  show()
  const incoming = screen.getByRole('heading', { name: 'Meeting requests sent to you' })
  const outgoing = screen.getByRole('heading', { name: 'Meeting requests you sent' })
  expect(incoming.compareDocumentPosition(outgoing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(await screen.findByText('2 awaiting response')).toBeInTheDocument()
})

test('opens an inline request above both lists, uses eligible contacts, and resets focus on cancel', async () => {
  show(); await screen.findByText('Policy discussion')
  const user = await openRequest()
  expect(screen.getByRole('form', { name: 'Request Appointment' }).compareDocumentPosition(screen.getByRole('heading', { name: 'Meeting requests sent to you' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText('Appointment Title')).toHaveFocus()
  await user.click(screen.getByRole('combobox', { name: 'Contact' }))
  expect(await screen.findByRole('option', { name: 'Alice Adams' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Bob Brown' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '+ New Appointment' })).toHaveFocus())
})

test('closes the appointment Contact dropdown when another field is clicked and reopens on return', async () => {
  show()
  const user = await openRequest()
  const contact = screen.getByRole('combobox', { name: 'Contact' })
  await user.click(contact)
  expect(await screen.findByRole('option', { name: 'Alice Adams' })).toBeInTheDocument()

  await user.click(screen.getByLabelText('Appointment Title'))
  expect(contact).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('listbox', { name: 'Contact options' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear Contact' })).not.toBeInTheDocument()

  await user.click(contact)
  await user.click(await screen.findByRole('option', { name: 'Alice Adams' }))
  expect(screen.getByRole('button', { name: 'Clear Contact' }).parentElement).toHaveTextContent('Alice Adams')
})

test.each(['mouse', 'touch'] as const)('closes the appointment Contact dropdown on an outside %s pointer', async (pointerType) => {
  show()
  const user = await openRequest()
  const contact = screen.getByRole('combobox', { name: 'Contact' })
  await user.click(contact)
  await screen.findByRole('option', { name: 'Alice Adams' })

  fireEvent.pointerDown(screen.getByRole('heading', { name: 'Meeting requests sent to you' }), { pointerType })
  expect(contact).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('listbox', { name: 'Contact options' })).not.toBeInTheDocument()
})

test('keeps appointment options selectable by keyboard and closes when focus leaves the lookup', async () => {
  show()
  const user = await openRequest()
  const contact = screen.getByRole('combobox', { name: 'Contact' })
  await user.click(contact)
  const option = await screen.findByRole('option', { name: 'Alice Adams' })

  await user.tab()
  expect(option).toHaveFocus()
  expect(contact).toHaveAttribute('aria-expanded', 'true')
  await user.tab()
  expect(screen.getByLabelText('Meeting Format')).toHaveFocus()
  expect(contact).toHaveAttribute('aria-expanded', 'false')
})

test('creates using the selected contact and format then refreshes the lists without a requester field', async () => {
  show(); const user = await openRequest(); await fillRequest(user)
  await user.click(screen.getByRole('button', { name: 'Submit Request' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Request Appointment' })).not.toBeInTheDocument())
  expect(service.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ title: 'New discussion', contact: expect.objectContaining({ id: alice.id }), meetingFormat: 2, preferredOffsetMinutes: -240 }))
  expect(vi.mocked(service.createAppointment).mock.calls[0][0]).not.toHaveProperty('requester')
  expect(service.getAppointmentPage).toHaveBeenCalledTimes(4)
})

test('only the actual recipient can respond, including when an administrator reads a request', async () => {
  show({ contactId: '99999999-9999-4999-8999-999999999999', isAdmin: true }); await userEvent.setup().click(screen.getByRole('button', { name: 'All Appointments' })); await screen.findByText('Sent request')
  expect(screen.queryByRole('button', { name: 'Accept Policy discussion' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accept Sent request' })).not.toBeInTheDocument()
})

test('requires HTTPS for Teams and preserves the link on a failed acceptance', async () => {
  vi.mocked(service.acceptAppointment).mockRejectedValue(new Error('Please try later.'))
  show(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
  await user.type(screen.getByLabelText('Microsoft Teams meeting link'), 'http://example.com/meeting')
  await user.click(screen.getByRole('button', { name: 'Confirm Acceptance' }))
  expect(await screen.findByText('Enter a valid HTTPS meeting link.')).toBeInTheDocument()
  expect(service.acceptAppointment).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('Microsoft Teams meeting link')); await user.type(screen.getByLabelText('Microsoft Teams meeting link'), 'https://example.com/meeting')
  await user.click(screen.getByRole('button', { name: 'Confirm Acceptance' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
  expect(screen.getByLabelText('Microsoft Teams meeting link')).toHaveValue('https://example.com/meeting')
})

test.each([[2, 'Phone Call'], [3, 'In Person']])('accepts format %s without a URL field', async (meetingFormat, meetingFormatLabel) => {
  incoming = [{ ...pending, meetingFormat, meetingFormatLabel }]
  show(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
  expect(screen.queryByLabelText('Microsoft Teams meeting link')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Confirm Acceptance' }))
  await waitFor(() => expect(service.acceptAppointment).toHaveBeenCalledWith(incoming[0], ''))
})

test('protects edited responses during card switching and keeps just one expanded response', async () => {
  show(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
  await user.type(screen.getByLabelText('Microsoft Teams meeting link'), 'https://example.com')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await user.click(screen.getByRole('button', { name: 'Request reschedule Outreach planning' }))
  expect(screen.getByRole('form', { name: 'Accept Policy discussion' })).toBeInTheDocument()
  expect(confirm).toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Request reschedule Outreach planning' }))
  expect(screen.queryByRole('form', { name: 'Accept Policy discussion' })).not.toBeInTheDocument()
  expect(screen.getByRole('form', { name: 'Reschedule Outreach planning' })).toBeInTheDocument()
})

test('requires a reason and an explicit offset for a reschedule in the autumn fold', async () => {
  show(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Request reschedule Policy discussion' }))
  await user.type(screen.getByLabelText('Rescheduling reason'), 'Schedule conflict')
  fireEvent.change(screen.getByLabelText('Suggested Date'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Suggested Time (Eastern Time)'), { target: { value: '01:30' } })
  await user.click(screen.getByRole('button', { name: 'Send Reschedule Request' }))
  expect(service.rescheduleAppointment).not.toHaveBeenCalled()
  await user.selectOptions(screen.getByLabelText('Time occurrence (Eastern Time)'), '-300')
  await user.click(screen.getByRole('button', { name: 'Send Reschedule Request' }))
  await waitFor(() => expect(service.rescheduleAppointment).toHaveBeenCalledWith(pending, { reason: 'Schedule conflict', suggestedDate: '2026-11-01', suggestedTime: '01:30', suggestedOffsetMinutes: -300 }))
})

test('keeps proposal details accessible from its compact status and never offers a proposal join link', async () => {
  incoming = [{ ...pending, status: 866530003, statusLabel: 'Rescheduled', suggestedDateTime: '2026-10-22T14:00:00Z', reschedulingReason: 'Schedule conflict', meetingLink: 'https://example.com' }]
  show(); await screen.findByText('Policy discussion')
  const status = screen.getByText('Rescheduled')
  expect(status).toHaveAccessibleDescription(/Proposal awaiting agreement/)
  expect(status).toHaveAccessibleDescription(/Schedule conflict/)
  expect(status).toHaveAccessibleDescription(/Original preferred time/)
  expect(status).toHaveAccessibleDescription(/Suggested time/)
  expect(screen.queryByRole('link', { name: 'Join meeting' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accept Policy discussion' })).not.toBeInTheDocument()
})

test('opens proposal details from the status by keyboard or pointer and closes with Escape or Close', async () => {
  incoming = [{ ...pending, status: 866530003, statusLabel: 'Rescheduled', suggestedDateTime: '2026-10-22T14:00:00Z', reschedulingReason: 'Schedule conflict' }]
  show(); const user = userEvent.setup()
  const status = await screen.findByRole('button', { name: 'Rescheduled' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  status.focus(); await user.keyboard('{Enter}')
  const panel = screen.getByRole('dialog', { name: 'Proposal awaiting agreement' })
  expect(panel).toHaveFocus()
  expect(panel).toHaveTextContent('Original preferred time: Oct 20, 2026, 9:30 AM EDT')
  expect(panel).toHaveTextContent('Suggested time: Oct 22, 2026, 10:00 AM EDT')
  expect(panel).toHaveTextContent('Schedule conflict')
  expect(panel).toHaveTextContent('unconfirmed and is not in My Calendar')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(status).toHaveFocus()
  await user.click(status)
  await user.click(screen.getByRole('button', { name: 'Close proposal details' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(status).toHaveFocus()
})

test('locks duplicate saves and switching until the pending save finishes', async () => {
  let resolve!: (value: { id: string }) => void
  vi.mocked(service.createAppointment).mockImplementation(() => new Promise((done) => { resolve = done }))
  show(); const user = await openRequest(); await fillRequest(user)
  const form = screen.getByRole('form', { name: 'Request Appointment' })
  fireEvent.submit(form); fireEvent.submit(form)
  expect(service.createAppointment).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Accept Policy discussion' })).toBeDisabled()
  await act(async () => resolve({ id: pending.id }))
})

test('shows independent list errors and retries while the other list remains visible', async () => {
  vi.mocked(service.getAppointmentPage).mockImplementation(async (view) => { if (view === 'incoming') throw new Error('Private CRM trace'); return { appointments: outgoing, awaitingCount: 0, nextLink: null } })
  show(); await screen.findByText('Sent request')
  expect(screen.queryByText('Private CRM trace')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry incoming appointments' })).toBeInTheDocument()
  expect(screen.queryByText('2 awaiting response')).not.toBeInTheDocument()
})

test('keeps create locked after an uncertain save until the refreshed list has been checked', async () => {
  vi.mocked(service.createAppointment).mockRejectedValue(new service.AppointmentSaveUncertainError('unknown'))
  show(); const user = await openRequest(); await fillRequest(user)
  await user.click(screen.getByRole('button', { name: 'Submit Request' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Request' })).toBeDisabled())
  await user.click(screen.getByRole('button', { name: 'Refresh outgoing appointments' }))
  await user.click(await screen.findByRole('button', { name: 'I checked the list; start a new request' }))
  expect(screen.queryByRole('form', { name: 'Request Appointment' })).not.toBeInTheDocument()
})

test('does not read private lists when there is no authenticated contact', () => {
  show({})
  expect(service.getAppointmentPage).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '+ New Appointment' })).not.toBeInTheDocument()
})

test('requires complete required fields and rejects a spring clock-change gap', async () => {
  show(); const user = await openRequest()
  await user.click(screen.getByRole('button', { name: 'Submit Request' }))
  expect(service.createAppointment).not.toHaveBeenCalled()
  expect(screen.getByText('Choose another eligible contact.')).toBeInTheDocument()
  await fillRequest(user)
  fireEvent.change(screen.getByLabelText('Preferred Date'), { target: { value: '2026-03-08' } })
  fireEvent.change(screen.getByLabelText('Preferred Time (Eastern Time)'), { target: { value: '02:30' } })
  await user.click(screen.getByRole('button', { name: 'Submit Request' }))
  expect(service.createAppointment).not.toHaveBeenCalled()
  expect(screen.getByText('This Eastern Time does not exist. Choose another date or time.')).toBeInTheDocument()
})

test('paginates incoming independently and reports the full awaiting count', async () => {
  vi.mocked(service.getAppointmentPage).mockImplementation(async (view, next) => ({ appointments: view === 'outgoing' ? outgoing : next ? [{ ...pending, title: 'Next page meeting' }] : incoming, awaitingCount: view === 'incoming' ? 18 : 0, nextLink: view === 'incoming' && !next ? '/_api/serverlogics/appointments?view=incoming&page=2' : null }))
  show(); const user = userEvent.setup()
  expect(await screen.findByText('18 awaiting response')).toBeInTheDocument()
  const pages = screen.getByRole('navigation', { name: 'incoming appointment pages' })
  await user.click(within(pages).getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Next page meeting')).toBeInTheDocument()
  expect(screen.getByText('Sent request')).toBeInTheDocument()
  await user.click(within(pages).getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Policy discussion')).toBeInTheDocument()
})

test('discards late responses when the authenticated identity changes', async () => {
  let late!: (page: { appointments: AppointmentRecord[]; awaitingCount: number; nextLink: null }) => void
  vi.mocked(service.getAppointmentPage).mockImplementation((view) => view === 'incoming' ? new Promise((resolve) => { late = resolve }) : Promise.resolve({ appointments: [], awaitingCount: 0, nextLink: null }))
  const rendered = show()
  rendered.rerender(<MemoryRouter><Appointments contactId={alice.id} /></MemoryRouter>)
  await act(async () => late({ appointments: incoming, awaitingCount: 2, nextLink: null }))
  expect(screen.queryByText('Policy discussion')).not.toBeInTheDocument()
})

test('shows safe join links only for accepted Teams and displays an unknown requester honestly', async () => {
  incoming = [{ ...pending, requester: null, status: 866530001, statusLabel: 'Accepted', meetingLink: 'https://example.com/meeting' }, { ...pending, id: 'other', title: 'Unsafe accepted link', status: 866530001, statusLabel: 'Accepted', meetingLink: 'javascript:alert(1)' }]
  show(); expect(await screen.findByText(/Requested by Unknown requester/)).toBeInTheDocument()
  const join = screen.getByRole('link', { name: 'Join meeting' })
  expect(join).toHaveAttribute('href', 'https://example.com/meeting')
  expect(join).toHaveAttribute('target', '_blank')
  expect(join).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getAllByRole('link', { name: 'Join meeting' })).toHaveLength(1)
})

test('a concurrency conflict refreshes and requires reviewing the current record', async () => {
  vi.mocked(service.acceptAppointment).mockRejectedValue(new service.AppointmentConflictError())
  incoming = [{ ...pending, meetingFormat: 2, meetingFormatLabel: 'Phone Call' }]
  show(); const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
  await user.click(screen.getByRole('button', { name: 'Confirm Acceptance' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('changed while you were responding')
  expect(screen.queryByRole('form', { name: 'Accept Policy discussion' })).not.toBeInTheDocument()
  expect(service.getAppointmentPage).toHaveBeenCalledTimes(4)
})

test('keeps an edited response visible when a pagination discard is declined', async () => {
  vi.mocked(service.getAppointmentPage).mockImplementation(async (view, next) => ({ appointments: view === 'incoming' ? next ? [] : incoming : outgoing, awaitingCount: 2, nextLink: view === 'incoming' && !next ? '/_api/serverlogics/appointments?view=incoming&page=2' : null }))
  show(); const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
  await user.type(screen.getByLabelText('Microsoft Teams meeting link'), 'https://example.com')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await user.click(within(screen.getByRole('navigation', { name: 'incoming appointment pages' })).getByRole('button', { name: 'Next' }))
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByRole('form', { name: 'Accept Policy discussion' })).toBeInTheDocument()
  confirm.mockReturnValue(true)
  await user.click(within(screen.getByRole('navigation', { name: 'incoming appointment pages' })).getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Accept Policy discussion' })).not.toBeInTheDocument())
})

test('preserves a failed request and confirms discard before resetting it', async () => {
  vi.mocked(service.createAppointment).mockRejectedValue(new Error('validation failed'))
  show(); const user = await openRequest(); await fillRequest(user)
  await user.click(screen.getByRole('button', { name: 'Submit Request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your entries are preserved')
  expect(screen.getByLabelText('Appointment Title')).toHaveValue('New discussion')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByLabelText('Appointment Title')).toHaveValue('New discussion')
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: '+ New Appointment' }))
  expect(screen.getByLabelText('Appointment Title')).toHaveValue('')
  expect(screen.getByLabelText('Meeting Format')).toHaveValue('')
})

test('hides redundant Pending beside response actions and retains it on outgoing requests', async () => {
  show()
  const card = (await screen.findByRole('heading', { name: 'Policy discussion' })).closest('li')!
  expect(within(card).queryByText('Pending')).not.toBeInTheDocument()
  const sent = (await screen.findByRole('heading', { name: 'Sent request' })).closest('li')!
  expect(within(sent).getByText('Pending').closest('.appointment-card__actions')).not.toBeNull()
  expect(within(card).getByText(/Requested by Alice Adams/)).toHaveTextContent('Requested by Alice Adams · Oct 20, 2026 at 9:30 AM ET')
  expect(within(card).getByText('Community priorities')).toBeInTheDocument()
  expect(within(card).queryByText('Microsoft Teams')).not.toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Accept Policy discussion' })).toBeInTheDocument()
})

test('uses the compact single selected contact until it is cleared', async () => {
  show(); const user = await openRequest()
  await user.click(screen.getByRole('combobox', { name: 'Contact' }))
  await user.click(await screen.findByRole('option', { name: 'Alice Adams' }))
  expect(screen.queryByRole('combobox', { name: 'Contact' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Clear Contact' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('combobox', { name: 'Contact' })).toHaveFocus()
})

test('admin personal lists filter unrelated rows and all loads only when selected', async () => {
 const user = userEvent.setup()
 show({ contactId: alice.id, isAdmin: true })
 await waitFor(() => expect(service.getAppointmentPage).toHaveBeenCalledTimes(2))
 expect(screen.queryByText('Policy discussion')).not.toBeInTheDocument()
 expect(screen.queryByText('Sent request')).not.toBeInTheDocument()
 expect(service.getAppointmentPage).not.toHaveBeenCalledWith('all', expect.anything(), expect.anything())
 await user.click(screen.getByRole('button', { name: 'All Appointments' }))
 expect(await screen.findByText('Sent request')).toBeInTheDocument()
 expect(screen.getByRole('button', { name: 'All Appointments' })).toHaveAttribute('aria-pressed', 'true')
 expect(screen.getByText(/Requested by Bob Brown.*Requested for Alice Adams/)).toBeInTheDocument()
 expect(screen.getByRole('button', { name: 'Accept Sent request' })).toBeInTheDocument()
})
test('ordinary users cannot select or fetch the all view', async () => {
 show(); await screen.findByText('Policy discussion')
 expect(screen.queryByRole('button', { name: 'All Appointments' })).not.toBeInTheDocument()
 expect(vi.mocked(service.getAppointmentPage).mock.calls.every(([view]) => view !== 'all')).toBe(true)
})
test('admin all view retries independently and honors draft discard and save locks', async () => {
 const user = userEvent.setup()
 vi.mocked(service.getAppointmentPage).mockImplementation(async (view) => { if (view === 'all') throw new Error('failed'); return { appointments: view === 'incoming' ? incoming : outgoing, awaitingCount: 2, nextLink: null } })
 show({ contactId: bob.id, isAdmin: true }); await screen.findByText('Policy discussion')
 await user.click(screen.getByRole('button', { name: '+ New Appointment' })); await user.type(screen.getByLabelText('Appointment Title'), 'Draft')
 const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
 await user.click(screen.getByRole('button', { name: 'All Appointments' }))
 expect(screen.getByLabelText('Appointment Title')).toHaveValue('Draft')
 expect(vi.mocked(service.getAppointmentPage).mock.calls.every(([view]) => view !== 'all')).toBe(true)
 confirm.mockReturnValue(true); await user.click(screen.getByRole('button', { name: 'All Appointments' }))
 await user.click(await screen.findByRole('button', { name: 'Retry all appointments' }))
 await waitFor(() => expect(vi.mocked(service.getAppointmentPage).mock.calls.filter(([view]) => view === 'all')).toHaveLength(2))
 expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('role changes clear privileged rows and drafts', async () => {
 const user = userEvent.setup(); const view = show({ contactId: bob.id, isAdmin: true })
 await user.click(screen.getByRole('button', { name: 'All Appointments' })); await screen.findByText('Sent request')
 await user.click(screen.getByRole('button', { name: '+ New Appointment' })); await user.type(screen.getByLabelText('Appointment Title'), 'Draft')
 view.rerender(<MemoryRouter><Appointments contactId={bob.id} isAdmin={false} /></MemoryRouter>)
 expect(screen.queryByRole('button', { name: 'All Appointments' })).not.toBeInTheDocument()
 expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('revoking and restoring the admin role does not reopen the privileged view', async () => {
 const user = userEvent.setup(); const view = show({ contactId: bob.id, isAdmin: true })
 await user.click(screen.getByRole('button', { name: 'All Appointments' })); await screen.findByText('Sent request')
 view.rerender(<MemoryRouter><Appointments contactId={bob.id} isAdmin={false} /></MemoryRouter>)
 view.rerender(<MemoryRouter><Appointments contactId={bob.id} isAdmin={true} /></MemoryRouter>)
 expect(screen.getByRole('button', { name: 'My Appointments' })).toHaveAttribute('aria-pressed', 'true')
})
test('all view pagination is independent and acceptance refreshes own and all lists', async () => {
 const user = userEvent.setup()
 const own = { ...pending, meetingFormat: 2, meetingFormatLabel: 'Phone Call' }
 vi.mocked(service.getAppointmentPage).mockImplementation(async (view, next) => ({ appointments: view === 'all' ? next ? [own] : [outgoing[0]] : view === 'incoming' ? incoming : outgoing, awaitingCount: 2, nextLink: view === 'all' && !next ? '/_api/serverlogics/appointments?view=all&page=2' : null }))
 let finish!: (result: { id: string }) => void
 vi.mocked(service.acceptAppointment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
 show({ contactId: bob.id, isAdmin: true }); await screen.findByText('Policy discussion')
 await user.click(screen.getByRole('button', { name: 'All Appointments' }))
 const pages = await screen.findByRole('navigation', { name: 'all appointment pages' })
 expect(screen.queryByText('2 awaiting response')).not.toBeInTheDocument()
 expect(screen.queryByRole('button', { name: 'Accept Sent request' })).not.toBeInTheDocument()
 await user.click(within(pages).getByRole('button', { name: 'Next' }))
 await user.click(await screen.findByRole('button', { name: 'Accept Policy discussion' }))
 expect(screen.getByRole('form')).toHaveTextContent(/both participants/)
 await user.click(screen.getByRole('button', { name: 'Confirm Acceptance' }))
 expect(screen.getByRole('button', { name: 'My Appointments' })).toBeDisabled()
 const calls = vi.mocked(service.getAppointmentPage).mock.calls.length
 await act(async () => finish({ id: pending.id }))
 await waitFor(() => expect(vi.mocked(service.getAppointmentPage).mock.calls.length).toBe(calls + 3))
 expect(screen.getByRole('status')).toHaveTextContent(/both participants/)
 expect(screen.getByText('Page 1')).toBeInTheDocument()
})
