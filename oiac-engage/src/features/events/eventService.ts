import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import type { EventInput, EventItem } from './eventTypes'

export type EventMutationResult = {
  readonly id: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const EVENT_SELECT = [
  'mss_eventsid',
  'mss_eventname',
  'mss_description',
  'mss_eventtype',
  'mss_eventformat',
  'mss_startdatetime',
  'mss_enddatetime',
  'mss_eventstatus',
  'mss_venuename',
  'mss_address',
  'mss_city',
  'mss_meetingurl',
] as const

const FORMATTED_VALUE = '@OData.Community.Display.V1.FormattedValue'
const EVENT_PREFER = `odata.include-annotations="OData.Community.Display.V1.FormattedValue"`
const EVENT_FORMAT_LABELS: Readonly<Record<number, string>> = {
  866530000: 'In Person',
  866530001: 'Virtual',
  866530002: 'Hybrid',
}
const EVENT_STATUS_LABELS: Readonly<Record<number, string>> = {
  866530000: 'Draft',
  866530001: 'Published',
  866530002: 'Registration Open',
  866530003: 'Registration Closed',
  866530004: 'Registration Closed',
  866530005: 'Cancelled',
  866530006: 'Postponed',
}
const EVENT_TYPE_LABELS: Readonly<Record<number, string>> = {
  866530000: 'Rally',
  866530001: 'Conference',
  866530002: 'Meeting',
  866530003: 'Community Event',
  866530004: 'Fundraiser',
  866530005: 'Webinar',
  866530006: 'Training',
  866530007: 'Town Hall',
  866530008: 'Campaign Event',
  866530009: 'Volunteer Event',
  866530010: 'Briefing',
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function choiceLabel(
  record: Record<string, unknown>,
  field: 'mss_eventformat' | 'mss_eventstatus' | 'mss_eventtype',
  labels: Readonly<Record<number, string>>,
  fallback: string,
): string {
  const formatted = record[`${field}${FORMATTED_VALUE}`]
  if (typeof formatted === 'string' && formatted) return formatted
  const value = integerOrNull(record[field])
  return value === null ? fallback : labels[value] ?? fallback
}

function mapEventRecord(value: unknown): EventItem {
  if (!isRecord(value)) throw new Error('Events could not be loaded.')
  const id = typeof value.mss_eventsid === 'string' ? value.mss_eventsid.trim() : ''
  if (!id) throw new Error('Events could not be loaded.')

  return {
    id,
    title: typeof value.mss_eventname === 'string' && value.mss_eventname
      ? value.mss_eventname
      : 'Untitled event',
    eventFormat: choiceLabel(value, 'mss_eventformat', EVENT_FORMAT_LABELS, 'Not specified'),
    eventFormatValue: integerOrNull(value.mss_eventformat),
    eventStatus: choiceLabel(value, 'mss_eventstatus', EVENT_STATUS_LABELS, 'Unknown'),
    eventStatusValue: integerOrNull(value.mss_eventstatus),
    eventType: choiceLabel(value, 'mss_eventtype', EVENT_TYPE_LABELS, 'Event'),
    eventTypeValue: integerOrNull(value.mss_eventtype),
    startDateTime: stringOrNull(value.mss_startdatetime),
    endDateTime: stringOrNull(value.mss_enddatetime),
    meetingUrl: stringOrNull(value.mss_meetingurl),
    venueName: stringOrNull(value.mss_venuename),
    description: stringOrNull(value.mss_description),
  }
}

function buildEventsQuery(isAdmin: boolean, now: Date): string {
  const params = new URLSearchParams()
  params.set('$select', EVENT_SELECT.join(','))
  if (!isAdmin) {
    params.set(
      '$filter',
      '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002)'
      + ` and mss_startdatetime ge ${now.toISOString()}`,
    )
  }
  params.set('$orderby', 'mss_startdatetime asc')
  return `?${params.toString()}`
}

export async function getEvents(isAdmin: boolean, signal?: AbortSignal): Promise<readonly EventItem[]> {
  const response = await powerPagesFetch<unknown>(`/_api/mss_eventses${buildEventsQuery(isAdmin, new Date())}`, {
    signal,
    headers: { Prefer: EVENT_PREFER },
  })
  if (!isRecord(response) || !Array.isArray(response.value)) {
    throw new Error('Events could not be loaded.')
  }
  return response.value.map(mapEventRecord)
}

function normalizeEventId(value: string): string {
  const normalized = value.trim().replace(/^\{+|\}+$/g, '').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error('Registered events could not be loaded.')
  }
  return normalized
}

export async function getCalendarEvents(
  eventIds: readonly string[],
  signal?: AbortSignal,
): Promise<readonly EventItem[]> {
  const normalizedIds = Array.from(new Set(eventIds.map(normalizeEventId)))
  if (normalizedIds.length === 0) return []
  if (normalizedIds.length > 100) throw new Error('Registered events could not be loaded.')

  const statusFilter = '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002'
    + ' or mss_eventstatus eq 866530003 or mss_eventstatus eq 866530004)'
  const idFilter = `(${normalizedIds.map((id) => `mss_eventsid eq ${id}`).join(' or ')})`
  const params = new URLSearchParams({
    $select: EVENT_SELECT.join(','),
    $filter: `${statusFilter} and mss_startdatetime ge ${new Date().toISOString()} and ${idFilter}`,
    $orderby: 'mss_startdatetime asc',
  })
  const response = await powerPagesFetch<unknown>(`/_api/mss_eventses?${params.toString()}`, {
    signal,
    headers: { Prefer: EVENT_PREFER },
  })
  if (!isRecord(response) || !Array.isArray(response.value)) {
    throw new Error('Registered events could not be loaded.')
  }
  try {
    return response.value.map(mapEventRecord)
  } catch {
    throw new Error('Registered events could not be loaded.')
  }
}

function buildEventPayload(input: EventInput): Record<string, string | number | null> {
  return {
    mss_eventname: input.title,
    mss_startdatetime: input.startDateTime,
    mss_enddatetime: input.endDateTime,
    mss_eventtype: input.eventTypeValue,
    mss_eventformat: input.eventFormatValue,
    mss_eventstatus: input.eventStatusValue,
    mss_venuename: input.venueName,
    mss_meetingurl: input.meetingUrl,
    mss_description: input.description,
  }
}

export async function createEvent(
  input: EventInput,
  signal?: AbortSignal,
): Promise<EventMutationResult> {
  try {
    const response = await powerPagesRequest('/_api/mss_eventses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventPayload(input)),
      signal,
    })
    const id = response.headers.get('entityid')?.trim().replace(/^\{+|\}+$/g, '') || null
    return { id }
  } catch {
    throw new Error('Event could not be saved.')
  }
}

export async function updateEvent(
  id: string,
  input: EventInput,
  signal?: AbortSignal,
): Promise<EventMutationResult> {
  const normalizedId = id.trim().replace(/^\{+|\}+$/g, '').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalizedId)) {
    throw new Error('Event could not be saved.')
  }
  try {
    await powerPagesRequest(`/_api/mss_eventses(${normalizedId})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventPayload(input)),
      signal,
    })
    return { id: normalizedId }
  } catch {
    throw new Error('Event could not be saved.')
  }
}
