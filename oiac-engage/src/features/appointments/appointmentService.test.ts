import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PowerPagesApiError, powerPagesFetch } from '../../shared/powerPagesApi'
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, type AppointmentRecord, type AppointmentRequestDraft } from './appointmentTypes'
import { acceptAppointment, AppointmentConflictError, AppointmentSaveUncertainError, createAppointment, getAppointmentPage, getCalendarAppointments, rescheduleAppointment, searchAppointmentContacts } from './appointmentService'

vi.mock('../../shared/powerPagesApi', async original => ({ ...await original<typeof import('../../shared/powerPagesApi')>(), powerPagesFetch: vi.fn() }))
const fetchMock = vi.mocked(powerPagesFetch)
const endpoint = '/_api/serverlogics/appointments'
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const contactId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const draft = (): AppointmentRequestDraft => ({ title: ' A meeting ', contact: { id: contactId, name: 'Recipient', email: null, jobTitle: null }, meetingFormat: 1, preferredDate: '2026-07-10', preferredTime: '09:30', preferredOffsetMinutes: null, agenda: '' })
const record = (): AppointmentRecord => ({ id, title: 'A meeting', status: APPOINTMENT_STATUS.pending, statusLabel: 'Pending', meetingFormat: APPOINTMENT_FORMAT.teams, meetingFormatLabel: 'Microsoft Teams', preferredDateTime: '2026-07-10T13:30:00Z', suggestedDateTime: null, agenda: '', meetingLink: null, reschedulingReason: '', requester: null, recipient: { id: contactId, name: 'Recipient' }, rowVersion: '12345' })
const envelope = (body: object) => ({ success: true, data: JSON.stringify(body) })
const page = (appointments: readonly AppointmentRecord[] = [], nextLink: string | null = null) => envelope({ ok: true, appointments, nextLink, awaitingCount: 2 })
beforeEach(() => vi.resetAllMocks())

describe('appointment reads', () => {
  test('unwraps actual transport, preserves labels and version, and passes cancellation', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(page([{ ...record(), statusLabel: 'En attente' }], `${endpoint}?view=incoming&page=2`))
    await expect(getAppointmentPage('incoming', null, signal)).resolves.toEqual({ appointments: [{ ...record(), statusLabel: 'En attente' }], nextLink: `${endpoint}?view=incoming&page=2`, awaitingCount: 2 })
    expect(fetchMock).toHaveBeenCalledWith(`${endpoint}?view=incoming&page=1`, { signal })
  })
  test('follows safe continuation for only the requested list', async () => {
    fetchMock.mockResolvedValue(page())
    await getAppointmentPage('outgoing', `${window.location.origin}${endpoint}?view=outgoing&page=2`)
    expect(fetchMock.mock.calls[0][0]).toBe(`${endpoint}?view=outgoing&page=2`)
  })
  test.each([`https://evil.example${endpoint}?view=incoming&page=2`, `${endpoint}?view=outgoing&page=2`, `${endpoint}?view=incoming&page=2&actor=x`, `${endpoint}?view=incoming&page=2&page=3`, `${endpoint}?view=incoming&page=0`, `${endpoint}?view=incoming&page=2#x`, '/_api/contacts?view=incoming&page=2'])('rejects unsafe continuation %s before reading', async link => {
    await expect(getAppointmentPage('incoming', link)).rejects.toThrow(/continuation/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('rejects malformed page, count, and row data', async () => {
    for (const body of [
      { appointments: Array(16).fill(record()), nextLink: null, awaitingCount: 0 },
      { appointments: [], nextLink: null, awaitingCount: -1 },
      { appointments: [], nextLink: `${endpoint}?view=outgoing&page=2`, awaitingCount: 0 },
      ...[{ id: `x${id}` }, { rowVersion: 'W/"123"' }, { preferredDateTime: '2026-02-30T13:30:00Z' }, { suggestedDateTime: '2026-07-11' }].map(patch => ({ appointments: [{ ...record(), ...patch }], nextLink: null, awaitingCount: 0 })),
    ]) {
      fetchMock.mockResolvedValueOnce(envelope({ ok: true, ...body }))
      await expect(getAppointmentPage('incoming')).rejects.toThrow()
    }
  })
  test('preserves an AbortError without changing it', async () => {
    const error = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(error)
    await expect(getAppointmentPage('incoming')).rejects.toBe(error)
  })
  test('loads all calendar pages, filters nonaccepted/wrong Eastern month, and deduplicates', async () => {
    const accepted = { ...record(), status: APPOINTMENT_STATUS.accepted, preferredDateTime: '2026-08-01T01:30:00Z' }
    const signal = new AbortController().signal
    fetchMock.mockResolvedValueOnce(page([accepted, record()], `${endpoint}?view=calendar&month=2026-07&page=2`))
      .mockResolvedValueOnce(page([accepted, { ...accepted, id: contactId, preferredDateTime: '2026-08-01T04:30:00Z' }]))
    await expect(getCalendarAppointments('2026-07', signal)).resolves.toEqual([accepted])
    expect(fetchMock).toHaveBeenCalledWith(`${endpoint}?view=calendar&month=2026-07&page=1`, { signal })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  test('rejects invalid months and unsafe calendar continuation', async () => {
    await expect(getCalendarAppointments('2026-13')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue(page([], `${endpoint}?view=calendar&month=2026-08&page=2`))
    await expect(getCalendarAppointments('2026-07')).rejects.toThrow(/continuation/i)
  })
  test('rejects repeated calendar pages and respects cancellation before any read', async () => {
    fetchMock.mockResolvedValue(page([], `${endpoint}?view=calendar&month=2026-07&page=1`))
    await expect(getCalendarAppointments('2026-07')).rejects.toThrow(/continuation/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockClear()
    const controller = new AbortController()
    controller.abort()
    await expect(getCalendarAppointments('2026-07', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('bounds Contact search and returns only lookup fields', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(envelope({ ok: true, contacts: [{ id: contactId, name: 'Recipient', forbiddenIdentity: 'must not leak' }] }))
    await expect(searchAppointmentContacts(" O'Brien ", signal)).resolves.toEqual([{ id: contactId, name: 'Recipient', email: null, jobTitle: null }])
    expect(fetchMock).toHaveBeenCalledWith(`${endpoint}?view=contacts&q=O%27Brien`, { signal })
    await searchAppointmentContacts('a'.repeat(151))
    expect(new URL(fetchMock.mock.calls[1][0], window.location.origin).searchParams.get('q')).toHaveLength(100)
    fetchMock.mockResolvedValue(envelope({ ok: true, contacts: Array(16).fill({ id: contactId, name: 'Recipient' }) }))
    await expect(searchAppointmentContacts('a')).rejects.toThrow()
  })
  test('normalizes contact search whitespace before querying the complete server directory', async () => {
    fetchMock.mockResolvedValue(envelope({ ok: true, contacts: [] }))
    await searchAppointmentContacts('  Muna   Sultana  ')
    expect(fetchMock).toHaveBeenCalledWith(`${endpoint}?view=contacts&q=Muna+Sultana`, { signal: undefined })
  })
  test('drops unusable contact labels and duplicate IDs while preserving valid selection IDs', async () => {
    const otherId = '77777777-7777-4777-8777-777777777777'
    fetchMock.mockResolvedValue(envelope({ ok: true, contacts: [
      { id: contactId, name: '  Muna   Sultana  ' },
      { id: contactId.toUpperCase(), name: 'Muna Sultana' },
      { id: otherId, name: 'Unknown contact' },
      { id: otherId, name: '  ' },
      { id: otherId, name: 'UNDEFINED' },
    ] }))
    await expect(searchAppointmentContacts('Muna')).resolves.toEqual([
      { id: contactId, name: 'Muna Sultana', email: null, jobTitle: null },
    ])
  })

})

describe('appointment writes', () => {
  test('creates with only allowlisted values and verified unique offset, never a browser requester', async () => {
    fetchMock.mockResolvedValue(envelope({ ok: true, id }))
    await expect(createAppointment({ ...draft(), requesterId: id } as AppointmentRequestDraft)).resolves.toEqual({ id })
    expect(fetchMock).toHaveBeenCalledWith(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'create', payload: { title: 'A meeting', recipientId: contactId, meetingFormat: 1, preferredDate: '2026-07-10', preferredTime: '09:30', preferredOffsetMinutes: -240, agenda: '' } }) })
  })
  test.each([{ title: '' }, { title: 'x'.repeat(851) }, { agenda: 'x'.repeat(101) }, { contact: null }, { contact: { id: `prefix${contactId}`, name: 'X', email: null, jobTitle: null } }, { meetingFormat: null }, { meetingFormat: 4 }, { preferredDate: '2026-02-30' }, { preferredDate: '2026-03-08', preferredTime: '02:30' }, { preferredOffsetMinutes: -300 }, { preferredDate: '2026-11-01', preferredTime: '01:30' }])('validates create locally: %j', async patch => {
    await expect(createAppointment({ ...draft(), ...patch })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('requires and sends selected valid fold offset', async () => {
    fetchMock.mockResolvedValue(envelope({ ok: true, id }))
    await createAppointment({ ...draft(), preferredDate: '2026-11-01', preferredTime: '01:30', preferredOffsetMinutes: -300 })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).payload.preferredOffsetMinutes).toBe(-300)
  })
  test.each(['validation', 'unauthenticated', 'forbidden'])('treats known pre-write %s as definite rejection', async code => {
    fetchMock.mockResolvedValue(envelope({ ok: false, error: { code, message: 'Rejected' } }))
    await expect(createAppointment(draft())).rejects.not.toBeInstanceOf(AppointmentSaveUncertainError)
  })
  test.each([envelope({ ok: false, error: { code: 'unavailable', message: 'Try later' } }), { success: false }, envelope({ ok: true, id: `prefix${id}` }), { ok: true }, 'malformed'])('classifies ambiguous success/error payloads as uncertain: %j', async response => {
    fetchMock.mockResolvedValue(response)
    await expect(createAppointment(draft())).rejects.toBeInstanceOf(AppointmentSaveUncertainError)
  })
  test('classifies network and HTTP 500 as uncertain, HTTP validation as definite', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network lost')).mockRejectedValueOnce(new PowerPagesApiError('Unavailable', 500)).mockRejectedValueOnce(new PowerPagesApiError('Rejected', 400))
    await expect(createAppointment(draft())).rejects.toBeInstanceOf(AppointmentSaveUncertainError)
    await expect(createAppointment(draft())).rejects.toBeInstanceOf(AppointmentSaveUncertainError)
    await expect(createAppointment(draft())).rejects.not.toBeInstanceOf(AppointmentSaveUncertainError)
  })
  test('accepts Teams with HTTPS link and immutable ID/version only', async () => {
    fetchMock.mockResolvedValue(envelope({ ok: true, id }))
    await expect(acceptAppointment(record(), ' https://teams.example/join ')).resolves.toEqual({ id })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ operation: 'accept', id, expectedRowVersion: '12345', payload: { meetingLink: 'https://teams.example/join' } })
  })
  test.each(['', 'http://teams.example/join', 'javascript:alert(1)', 'https://user:secret@teams.example/join', `https://teams.example/${'x'.repeat(2000)}`])('rejects invalid Teams URL %s', async link => {
    await expect(acceptAppointment(record(), link)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test.each([APPOINTMENT_FORMAT.phone, APPOINTMENT_FORMAT.inPerson])('accepts format %s with no meeting URL', async meetingFormat => {
    fetchMock.mockResolvedValue(envelope({ ok: true, id }))
    await acceptAppointment({ ...record(), meetingFormat }, '')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).payload).toEqual({ meetingLink: '' })
  })
  test('reschedules without changing original time or participants', async () => {
    fetchMock.mockResolvedValue(envelope({ ok: true, id }))
    await rescheduleAppointment(record(), { reason: ' A reason ', suggestedDate: '2026-12-01', suggestedTime: '10:00', suggestedOffsetMinutes: null })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ operation: 'reschedule', id, expectedRowVersion: '12345', payload: { reason: 'A reason', suggestedDate: '2026-12-01', suggestedTime: '10:00', suggestedOffsetMinutes: -300 } })
  })
  test.each([{ id: `prefix${id}` }, { rowVersion: '' }, { rowVersion: ' 12345' }, { rowVersion: 'W/"123"' }, { status: APPOINTMENT_STATUS.accepted }])('rejects invalid response record %j before writing', async patch => {
    await expect(acceptAppointment({ ...record(), ...patch }, 'https://teams.example/join')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('rejects invalid reschedule values before writing', async () => {
    for (const patch of [{ reason: '' }, { reason: 'x'.repeat(101) }, { suggestedDate: '2026-03-08', suggestedTime: '02:30' }]) {
      await expect(rescheduleAppointment(record(), { reason: 'Reason', suggestedDate: '2026-12-01', suggestedTime: '10:00', suggestedOffsetMinutes: null, ...patch })).rejects.toThrow()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('surfaces endpoint and HTTP concurrency conflicts and rejects mismatched save IDs', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ ok: false, error: { code: 'conflict', message: 'Changed' } })).mockRejectedValueOnce(new PowerPagesApiError('Conflict', 409)).mockResolvedValueOnce(envelope({ ok: true, id: contactId }))
    await expect(acceptAppointment(record(), 'https://teams.example/join')).rejects.toBeInstanceOf(AppointmentConflictError)
    await expect(rescheduleAppointment(record(), { reason: 'Reason', suggestedDate: '2026-12-01', suggestedTime: '10:00', suggestedOffsetMinutes: null })).rejects.toBeInstanceOf(AppointmentConflictError)
    await expect(acceptAppointment(record(), 'https://teams.example/join')).rejects.toThrow()
  })
})

 test('reads all with a matching safe continuation and rejects list swapping', async () => {
   fetchMock.mockResolvedValue(page([record()], `${endpoint}?view=all&page=3`))
   await expect(getAppointmentPage('all', `${endpoint}?view=all&page=2`)).resolves.toMatchObject({ appointments: [record()], nextLink: `${endpoint}?view=all&page=3` })
   expect(fetchMock).toHaveBeenCalledWith(`${endpoint}?view=all&page=2`, { signal: undefined })
   fetchMock.mockClear()
   await expect(getAppointmentPage('all', `${endpoint}?view=incoming&page=2`)).rejects.toThrow(/continuation/i)
   expect(fetchMock).not.toHaveBeenCalled()
 })
