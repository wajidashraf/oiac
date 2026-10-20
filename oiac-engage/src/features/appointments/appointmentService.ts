import { PowerPagesApiError, PowerPagesDataError, powerPagesFetch } from '../../shared/powerPagesApi'
import type { ContactOption } from '../meetingReports/meetingReportTypes'
import { appointmentCalendarDate, getEasternTimeOptions } from './appointmentDates'
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, type AppointmentPage, type AppointmentPerson, type AppointmentRecord, type AppointmentRequestDraft, type AppointmentRescheduleDraft } from './appointmentTypes'

const endpoint = '/_api/serverlogics/appointments'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type DataRecord = Record<string, unknown>
type ListView = 'incoming' | 'outgoing' | 'all' | 'calendar'

export class AppointmentSaveUncertainError extends Error {
  constructor(message = 'The appointment may have been saved. Refresh your sent requests to check before creating another appointment.') {
    super(message)
    this.name = 'AppointmentSaveUncertainError'
  }
}

export class AppointmentConflictError extends Error {
  constructor(message = 'This appointment has changed. Refresh the requests and review its current state.') {
    super(message)
    this.name = 'AppointmentConflictError'
  }
}

class AppointmentRejectedError extends PowerPagesApiError {}

function object(value: unknown): DataRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PowerPagesDataError()
  return value as DataRecord
}

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) as unknown } catch { throw new PowerPagesDataError() }
}

function envelope(value: unknown): DataRecord {
  let body = object(parse(value))
  if ('success' in body) {
    if (body.success !== true) throw new PowerPagesDataError()
    body = object(parse(body.data))
  }
  if (body.ok === false) {
    const error = object(body.error)
    if (error.code === 'conflict') throw new AppointmentConflictError()
    throw new AppointmentRejectedError('The appointment operation could not be completed.', undefined, { code: typeof error.code === 'string' ? error.code : undefined })
  }
  if (body.ok !== true) throw new PowerPagesDataError()
  return body
}

function guid(value: unknown): string {
  if (typeof value !== 'string' || !GUID.test(value)) throw new PowerPagesDataError('A valid appointment or Contact identifier is required.')
  return value.toLowerCase()
}

function version(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value)) throw new PowerPagesDataError('The appointment row version is invalid.')
  return value
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new PowerPagesDataError()
  return value
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new PowerPagesDataError()
  return value
}

function instant(value: unknown): string {
  if (typeof value !== 'string' || appointmentCalendarDate(value) === null) throw new PowerPagesDataError('The appointment UTC date response is invalid.')
  return value
}

function person(value: unknown): AppointmentPerson | null {
  if (value === null) return null
  const raw = object(value)
  return { id: guid(raw.id), name: text(raw.name) }
}

function safeMeetingLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 2000) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? value : null
  } catch { return null }
}

function mapRecord(value: unknown): AppointmentRecord {
  const raw = object(value)
  if (raw.meetingLink !== null && typeof raw.meetingLink !== 'string') throw new PowerPagesDataError()
  return {
    id: guid(raw.id), title: text(raw.title), status: integer(raw.status), statusLabel: text(raw.statusLabel),
    meetingFormat: integer(raw.meetingFormat), meetingFormatLabel: text(raw.meetingFormatLabel),
    preferredDateTime: instant(raw.preferredDateTime), suggestedDateTime: raw.suggestedDateTime === null ? null : instant(raw.suggestedDateTime),
    agenda: text(raw.agenda), meetingLink: safeMeetingLink(raw.meetingLink), reschedulingReason: text(raw.reschedulingReason),
    requester: person(raw.requester), recipient: person(raw.recipient), rowVersion: version(raw.rowVersion),
  }
}

function continuation(link: string, view: ListView, month?: string): string {
  let url: URL
  try { url = new URL(link, window.location.origin) } catch { throw new PowerPagesDataError('Invalid appointment continuation link.') }
  const params = [...url.searchParams]
  const allowed = month ? ['view', 'month', 'page'] : ['view', 'page']
  const page = url.searchParams.get('page') ?? ''
  if (url.origin !== window.location.origin || url.pathname !== endpoint || url.hash || url.username || url.password
    || params.length !== allowed.length || allowed.some(key => url.searchParams.getAll(key).length !== 1)
    || params.some(([key]) => !allowed.includes(key)) || url.searchParams.get('view') !== view
    || (month !== undefined && url.searchParams.get('month') !== month)
    || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) throw new PowerPagesDataError('Invalid appointment continuation link.')
  return `${url.pathname}${url.search}`
}

async function readPage(view: ListView, nextLink: string | null | undefined, signal?: AbortSignal, month?: string): Promise<AppointmentPage> {
  const initial = `${endpoint}?view=${view}${month ? `&month=${month}` : ''}&page=1`
  const path = nextLink ? continuation(nextLink, view, month) : initial
  const body = envelope(await powerPagesFetch<unknown>(path, { signal }))
  if (!Array.isArray(body.appointments) || body.appointments.length > 15 || (body.nextLink !== null && typeof body.nextLink !== 'string')) throw new PowerPagesDataError()
  const next = body.nextLink === null ? null : continuation(body.nextLink as string, view, month)
  if (next && Number(new URL(next, window.location.origin).searchParams.get('page')) <= Number(new URL(path, window.location.origin).searchParams.get('page'))) throw new PowerPagesDataError('Invalid appointment continuation link.')
  return { appointments: body.appointments.map(mapRecord), nextLink: next, awaitingCount: integer(body.awaitingCount) }
}

export async function getAppointmentPage(view: 'incoming' | 'outgoing' | 'all', nextLink?: string | null, signal?: AbortSignal): Promise<AppointmentPage> {
  if (view !== 'incoming' && view !== 'outgoing' && view !== 'all') throw new Error('Invalid appointment list.')
  return readPage(view, nextLink, signal)
}

export async function getCalendarAppointments(month: string, signal?: AbortSignal): Promise<readonly AppointmentRecord[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1753) throw new Error('A valid appointment calendar month is required.')
  const appointments = new Map<string, AppointmentRecord>()
  let nextLink: string | null = null
  for (let pages = 0; pages < 200; pages++) {
    signal?.throwIfAborted()
    const page = await readPage('calendar', nextLink, signal, month)
    for (const record of page.appointments) {
      if (record.status === APPOINTMENT_STATUS.accepted && appointmentCalendarDate(record.preferredDateTime)?.startsWith(`${month}-`)) appointments.set(record.id, record)
    }
    nextLink = page.nextLink
    if (!nextLink) return [...appointments.values()]
  }
  throw new PowerPagesDataError('The appointment calendar returned too many pages.')
}

export async function searchAppointmentContacts(search: string, signal?: AbortSignal): Promise<readonly ContactOption[]> {
  const params = new URLSearchParams({ view: 'contacts', q: search.trim().slice(0, 150) })
  const body = envelope(await powerPagesFetch<unknown>(`${endpoint}?${params}`, { signal }))
  if (!Array.isArray(body.contacts) || body.contacts.length > 15) throw new PowerPagesDataError()
  return body.contacts.map(value => {
    const raw = object(value)
    return { id: guid(raw.id), name: text(raw.name), email: null, jobTitle: null }
  })
}

function inputText(value: string, label: string, max: number, required = false): string {
  if (typeof value !== 'string') throw new Error(`${label} is invalid.`)
  const normalized = value.trim()
  if (required && !normalized) throw new Error(`${label} is required.`)
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return normalized
}

function offset(date: string, time: string, selected: number | null): number {
  const options = getEasternTimeOptions(date, time)
  if (!options.length) throw new Error('Choose a valid Eastern date and time. The selected time may fall in the daylight-saving gap.')
  if (selected === null && options.length === 1) return options[0].offsetMinutes
  const match = options.find(option => option.offsetMinutes === selected)
  if (!match) throw new Error('Choose the Eastern UTC offset for this date and time.')
  return match.offsetMinutes
}

function meetingFormat(value: number | null): number {
  if (value !== APPOINTMENT_FORMAT.teams && value !== APPOINTMENT_FORMAT.phone && value !== APPOINTMENT_FORMAT.inPerson) throw new Error('Choose a meeting format.')
  return value
}

async function post(payload: DataRecord): Promise<string> {
  const body = envelope(await powerPagesFetch<unknown>(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  return guid(body.id)
}

export async function createAppointment(draft: AppointmentRequestDraft): Promise<{ id: string }> {
  // Validate before starting the uncertain-write boundary: local errors are safe to correct.
  const payload = {
    title: inputText(draft.title, 'Title', 850, true), recipientId: guid(draft.contact?.id), meetingFormat: meetingFormat(draft.meetingFormat),
    preferredDate: draft.preferredDate, preferredTime: draft.preferredTime,
    preferredOffsetMinutes: offset(draft.preferredDate, draft.preferredTime, draft.preferredOffsetMinutes), agenda: inputText(draft.agenda, 'Agenda', 100),
  }
  try {
    return { id: await post({ operation: 'create', payload }) }
  } catch (error) {
    // A failed response may arrive after commit. Only known pre-write rejections permit retry.
    const definite = error instanceof AppointmentRejectedError
      ? ['validation', 'unauthenticated', 'forbidden'].includes(error.code ?? '')
      : error instanceof PowerPagesApiError && [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(error.status ?? 0)
    if (definite) throw error
    throw new AppointmentSaveUncertainError()
  }
}

async function respond(record: AppointmentRecord, operation: 'accept' | 'reschedule', payload: DataRecord): Promise<{ id: string }> {
  const id = guid(record.id)
  const expectedRowVersion = version(record.rowVersion)
  if (record.status !== APPOINTMENT_STATUS.pending) throw new AppointmentConflictError()
  try {
    const resultId = await post({ operation, id, expectedRowVersion, payload })
    if (resultId !== id) throw new PowerPagesDataError()
    return { id: resultId }
  } catch (error) {
    if (error instanceof PowerPagesApiError && [409, 412].includes(error.status ?? 0)) throw new AppointmentConflictError()
    throw error
  }
}

export async function acceptAppointment(record: AppointmentRecord, meetingLink: string): Promise<{ id: string }> {
  const format = meetingFormat(record.meetingFormat)
  const link = format === APPOINTMENT_FORMAT.teams ? inputText(meetingLink, 'Meeting link', 2000, true) : ''
  if (format === APPOINTMENT_FORMAT.teams && !safeMeetingLink(link)) throw new Error('Enter a valid HTTPS meeting link.')
  return respond(record, 'accept', { meetingLink: link })
}

export async function rescheduleAppointment(record: AppointmentRecord, draft: AppointmentRescheduleDraft): Promise<{ id: string }> {
  const payload = {
    reason: inputText(draft.reason, 'Reason', 100, true), suggestedDate: draft.suggestedDate, suggestedTime: draft.suggestedTime,
    suggestedOffsetMinutes: offset(draft.suggestedDate, draft.suggestedTime, draft.suggestedOffsetMinutes),
  }
  return respond(record, 'reschedule', payload)
}
