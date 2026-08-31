import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import {
  EVENT_REGISTRATION_STATUS,
  type EventRegistration,
  type RegistrationOutcome,
  type RegistrationStatus,
} from './eventRegistrationTypes'

export { EVENT_REGISTRATION_STATUS } from './eventRegistrationTypes'
export type { EventRegistration, RegistrationOutcome, RegistrationStatus } from './eventRegistrationTypes'

const registrationSelect = [
  'mss_eventregistrationid',
  '_mss_contact_value',
  '_mss_event_value',
  'mss_registrationdate',
  'mss_registrationnumber',
  'mss_registrationstatus',
].join(',')

type RegistrationCollectionEnvelope = {
  readonly value?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeGuid(value: string, label: 'Contact' | 'Event' | 'Event Registration'): string {
  const normalized = value.trim().replace(/^\{+|\}+$/g, '').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`A valid ${label} ID is required.`)
  }
  return normalized
}

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return value === EVENT_REGISTRATION_STATUS.registered
    || value === EVENT_REGISTRATION_STATUS.cancelled
    || value === EVENT_REGISTRATION_STATUS.waitlisted
}

function mapRegistration(value: unknown): EventRegistration {
  if (!isRecord(value)) throw new Error('Event registrations could not be loaded.')

  const id = typeof value.mss_eventregistrationid === 'string'
    ? normalizeGuid(value.mss_eventregistrationid, 'Event Registration')
    : ''
  const contactId = typeof value._mss_contact_value === 'string'
    ? normalizeGuid(value._mss_contact_value, 'Contact')
    : ''
  const eventId = typeof value._mss_event_value === 'string'
    ? normalizeGuid(value._mss_event_value, 'Event')
    : ''
  const status = value.mss_registrationstatus

  if (!id || !contactId || !eventId || !isRegistrationStatus(status)) {
    throw new Error('Event registrations could not be loaded.')
  }

  return {
    id,
    contactId,
    eventId,
    registrationDate: typeof value.mss_registrationdate === 'string' ? value.mss_registrationdate : null,
    registrationNumber: typeof value.mss_registrationnumber === 'string' ? value.mss_registrationnumber : null,
    status,
  }
}

function buildRegistrationQuery(contactId: string, eventId?: string): string {
  const filters = [`_mss_contact_value eq ${contactId}`]
  if (eventId) filters.push(`_mss_event_value eq ${eventId}`)
  const params = new URLSearchParams({
    $select: registrationSelect,
    $filter: filters.join(' and '),
    $orderby: 'mss_registrationdate desc',
  })
  return `/_api/mss_eventregistrations?${params.toString()}`
}

async function loadRegistrations(
  contactId: string,
  eventId?: string,
  signal?: AbortSignal,
): Promise<readonly EventRegistration[]> {
  const envelope = await powerPagesFetch<RegistrationCollectionEnvelope>(
    buildRegistrationQuery(contactId, eventId),
    { signal },
  )
  if (!Array.isArray(envelope?.value)) throw new Error('Event registrations could not be loaded.')
  return envelope.value.map(mapRegistration)
}

export async function getEventRegistrations(
  contactId: string,
  signal?: AbortSignal,
): Promise<readonly EventRegistration[]> {
  return loadRegistrations(normalizeGuid(contactId, 'Contact'), undefined, signal)
}

function selectExistingRegistration(
  registrations: readonly EventRegistration[],
): EventRegistration | undefined {
  return registrations.find((item) => item.status === EVENT_REGISTRATION_STATUS.registered)
    ?? registrations.find((item) => item.status === EVENT_REGISTRATION_STATUS.waitlisted)
    ?? registrations.find((item) => item.status === EVENT_REGISTRATION_STATUS.cancelled)
}

function outcomeForExisting(registration: EventRegistration): RegistrationOutcome {
  return {
    outcome: registration.status === EVENT_REGISTRATION_STATUS.waitlisted
      ? 'waitlisted'
      : 'already-registered',
    registration,
  }
}

async function recoverCommittedRegistration(
  contactId: string,
  eventId: string,
): Promise<RegistrationOutcome | null> {
  const existing = selectExistingRegistration(await loadRegistrations(contactId, eventId))
  if (!existing || existing.status !== EVENT_REGISTRATION_STATUS.registered) return null
  return outcomeForExisting(existing)
}

export async function registerForEvent(
  contactIdValue: string,
  eventIdValue: string,
  registeredAt: Date = new Date(),
): Promise<RegistrationOutcome> {
  const contactId = normalizeGuid(contactIdValue, 'Contact')
  const eventId = normalizeGuid(eventIdValue, 'Event')
  if (Number.isNaN(registeredAt.getTime())) throw new Error('A valid Registration Date is required.')

  const existing = selectExistingRegistration(await loadRegistrations(contactId, eventId))
  if (existing?.status === EVENT_REGISTRATION_STATUS.registered
    || existing?.status === EVENT_REGISTRATION_STATUS.waitlisted) {
    return outcomeForExisting(existing)
  }

  const registrationDate = registeredAt.toISOString()
  if (existing?.status === EVENT_REGISTRATION_STATUS.cancelled) {
    await powerPagesRequest(`/_api/mss_eventregistrations(${existing.id})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mss_registrationdate: registrationDate,
        mss_registrationstatus: EVENT_REGISTRATION_STATUS.registered,
      }),
    })
    return {
      outcome: 'registered',
      registration: {
        ...existing,
        registrationDate,
        status: EVENT_REGISTRATION_STATUS.registered,
      },
    }
  }

  const payload = {
    mss_registrationdate: registrationDate,
    mss_registrationstatus: EVENT_REGISTRATION_STATUS.registered,
    'mss_Event@odata.bind': `/mss_eventses(${eventId})`,
    'mss_Contact@odata.bind': `/contacts(${contactId})`,
  }

  let response: Response
  try {
    response = await powerPagesRequest('/_api/mss_eventregistrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    const recovered = await recoverCommittedRegistration(contactId, eventId).catch(() => null)
    if (recovered) return recovered
    throw error
  }

  const headerId = response.headers.get('entityid')
  if (!headerId) {
    const recovered = await recoverCommittedRegistration(contactId, eventId)
    if (recovered) return recovered
    throw new Error('Event registration was saved but could not be confirmed.')
  }

  const id = normalizeGuid(headerId, 'Event Registration')
  return {
    outcome: 'registered',
    registration: {
      id,
      contactId,
      eventId,
      registrationDate,
      registrationNumber: null,
      status: EVENT_REGISTRATION_STATUS.registered,
    },
  }
}
