import { PowerPagesApiError, powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import type {
  ContactLookupKind,
  ContactOption,
  DistrictOption,
  MeetingFormat,
  MeetingReportDetails,
  MeetingReportDraft,
  MeetingReportProfile,
  MeetingReportPage,
  MeetingReportQuery,
  MeetingReportSummary,
  MeetingSentiment,
  RelationshipOperation,
  RelationshipSelection,
} from './meetingReportTypes'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOOKUP_LIMIT = 15
export const MEETING_REPORT_PAGE_SIZE = 15

const CONTACT_SELECT = ['contactid', 'fullname', 'emailaddress1', 'jobtitle'] as const
const REPORT_SELECT = [
  'mss_meetingreportid',
  'mss_subject',
  'mss_startdateandtime',
  'mss_enddateandtime',
  'mss_dateofmeeting',
  '_mss_representative_value',
  '_mss_district_value',
  'mss_meetingformat',
  'mss_writedownwhatthestaffsaidnotwhatyousaid',
  'mss_followupnoteoncethemeetingended',
  'mss_documentsprovided',
  'mss_overallsentiment',
] as const

const RELATIONSHIP_SCHEMAS = {
  staff: 'mss_MeetingReport_Contact_Staff',
  volunteer: 'mss_MeetingReport_Contact_Volunteers',
} as const

const SENTIMENT_LABELS: Record<MeetingSentiment, string> = {
  1: 'Very Supportive',
  2: 'Supportive',
  3: 'Neutral',
  4: 'Non-committal',
  5: 'Opposed',
}

export class MeetingReportCreateOutcomeUnknownError extends Error {
  constructor() {
    super('Dataverse did not return the created Meeting Report identifier.')
    this.name = 'MeetingReportCreateOutcomeUnknownError'
  }
}

type ContactApiRecord = {
  readonly contactid?: unknown
  readonly fullname?: unknown
  readonly emailaddress1?: unknown
  readonly jobtitle?: unknown
  readonly address1_city?: unknown
  readonly address1_stateorprovince?: unknown
  readonly _mss_district_value?: unknown
}

type DistrictApiRecord = {
  readonly mss_districtid?: unknown
  readonly mss_number?: unknown
}

type ReportApiRecord = {
  readonly mss_meetingreportid?: unknown
  readonly mss_subject?: unknown
  readonly mss_startdateandtime?: unknown
  readonly mss_enddateandtime?: unknown
  readonly mss_dateofmeeting?: unknown
  readonly _mss_representative_value?: unknown
  readonly '_mss_representative_value@OData.Community.Display.V1.FormattedValue'?: unknown
  readonly _mss_district_value?: unknown
  readonly '_mss_district_value@OData.Community.Display.V1.FormattedValue'?: unknown
  readonly mss_meetingformat?: unknown
  readonly mss_writedownwhatthestaffsaidnotwhatyousaid?: unknown
  readonly mss_followupnoteoncethemeetingended?: unknown
  readonly mss_documentsprovided?: unknown
  readonly mss_overallsentiment?: unknown
  readonly mss_MeetingReport_Contact_Staff?: readonly ContactApiRecord[]
  readonly mss_MeetingReport_Contact_Volunteers?: readonly ContactApiRecord[]
}

export function normalizeGuid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^\{(.+)\}$/, '$1').toLowerCase()
  return GUID_PATTERN.test(normalized) ? normalized : null
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

function toLocalDateTimeValue(value: unknown): string {
  const rawValue = text(value)
  if (!rawValue) return ''
  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${twoDigits(parsed.getMonth() + 1)}-${twoDigits(parsed.getDate())}`
    + `T${twoDigits(parsed.getHours())}:${twoDigits(parsed.getMinutes())}`
}

function parseLocalDateTime(value: string, label: string): Date {
  const normalized = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(normalized)
  if (!match) throw new Error(`A valid ${label} is required.`)

  const [, year, month, day, hour, minute] = match.map(Number)
  const parsed = new Date(year, month - 1, day, hour, minute)
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
    || parsed.getHours() !== hour
    || parsed.getMinutes() !== minute
  ) throw new Error(`A valid ${label} is required.`)
  return parsed
}

function requiredGuid(value: unknown, label: string): string {
  const guid = normalizeGuid(value)
  if (!guid) throw new Error(`${label} does not contain a valid Dataverse identifier.`)
  return guid
}

function mapContact(record: ContactApiRecord): ContactOption {
  return {
    id: requiredGuid(record.contactid, 'Contact'),
    name: text(record.fullname) || 'Unnamed contact',
    email: text(record.emailaddress1) || null,
    jobTitle: text(record.jobtitle) || null,
  }
}

function mapDistrict(record: DistrictApiRecord): DistrictOption {
  return {
    id: requiredGuid(record.mss_districtid, 'District'),
    name: text(record.mss_number) || 'Unnamed district',
  }
}

function asMeetingFormat(value: unknown): MeetingFormat | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null
}

function asSentiment(value: unknown): MeetingSentiment | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null
}

function uniqueGuids(values: readonly string[]): string[] {
  const ids = new Set<string>()
  for (const value of values) {
    const id = normalizeGuid(value)
    if (id) ids.add(id)
  }
  return [...ids]
}

export function buildContactLookupQuery(kind: ContactLookupKind, search: string): string {
  const filters: string[] = []
  if (kind === 'staff') filters.push("contains(jobtitle,'Staff')")
  if (kind === 'volunteer') filters.push("contains(jobtitle,'Volunteer')")

  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    const escaped = escapeODataString(normalizedSearch)
    filters.push(`(contains(fullname,'${escaped}') or contains(emailaddress1,'${escaped}'))`)
  }

  const params = new URLSearchParams()
  params.set('$select', CONTACT_SELECT.join(','))
  if (filters.length > 0) params.set('$filter', filters.join(' and '))
  params.set('$orderby', 'fullname asc,contactid asc')
  params.set('$top', String(LOOKUP_LIMIT))
  return `?${params.toString()}`
}

export function buildDistrictLookupQuery(search: string): string {
  const params = new URLSearchParams()
  params.set('$select', 'mss_districtid,mss_number')
  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    params.set('$filter', `contains(mss_number,'${escapeODataString(normalizedSearch)}')`)
  }
  params.set('$orderby', 'mss_number asc,mss_districtid asc')
  params.set('$top', String(LOOKUP_LIMIT))
  return `?${params.toString()}`
}

export async function searchContacts(
  kind: ContactLookupKind,
  search: string,
  signal?: AbortSignal,
): Promise<readonly ContactOption[]> {
  const response = await powerPagesFetch<{ readonly value?: readonly ContactApiRecord[] }>(
    `/_api/contacts${buildContactLookupQuery(kind, search)}`,
    { signal },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid Contact lookup response.')
  return response.value.map(mapContact)
}

export async function searchDistricts(
  search: string,
  signal?: AbortSignal,
): Promise<readonly DistrictOption[]> {
  const response = await powerPagesFetch<{ readonly value?: readonly DistrictApiRecord[] }>(
    `/_api/mss_districts${buildDistrictLookupQuery(search)}`,
    { signal },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid District lookup response.')
  return response.value.map(mapDistrict)
}

export async function getMeetingReportProfile(
  contactId: string,
  signal?: AbortSignal,
): Promise<MeetingReportProfile> {
  console.debug('[MeetingReportProfile] loading profile', {
    contactId,
    signalAborted: signal?.aborted ?? false,
  })
  const id = requiredGuid(contactId, 'Authenticated Contact')
  const contactUrl = `/_api/contacts(${id})?$select=contactid,fullname,emailaddress1,address1_city,address1_stateorprovince,_mss_district_value`
  console.debug('[MeetingReportProfile] requesting Contact', { normalizedContactId: id, contactUrl })
  const contact = await powerPagesFetch<ContactApiRecord>(
    contactUrl,
    { signal },
  )
  console.debug('[MeetingReportProfile] Contact received', { contact })
  const resolvedContactId = requiredGuid(contact.contactid, 'Authenticated Contact')
  const resolvedDistrictId = normalizeGuid(contact._mss_district_value)
  console.debug('[MeetingReportProfile] district resolved', { resolvedDistrictId })
  let districtName = ''

  if (resolvedDistrictId) {
    const districtUrl = `/_api/mss_districts(${resolvedDistrictId})?$select=mss_districtid,mss_number`
    console.debug('[MeetingReportProfile] requesting District', { districtUrl })
    const district = await powerPagesFetch<DistrictApiRecord>(
      districtUrl,
      { signal },
    )
    console.debug('[MeetingReportProfile] District received', { district })
    districtName = text(district.mss_number)
  }

  return {
    contactId: resolvedContactId,
    fullName: text(contact.fullname),
    email: text(contact.emailaddress1),
    city: text(contact.address1_city),
    stateOrProvince: text(contact.address1_stateorprovince),
    districtId: resolvedDistrictId,
    districtName,
  }
}

export function buildMeetingReportPayload(
  draft: MeetingReportDraft,
  ownerContactId?: string,
  includeOwner = false,
): Record<string, string | number> {
  const representativeId = requiredGuid(draft.representativeId, 'Representative')
  const districtId = requiredGuid(draft.districtId, 'District')
  if (!draft.subject.trim()) throw new Error('Subject is required.')
  const startDateTime = parseLocalDateTime(draft.startDateTime, 'Start Date and Time')
  const endDateTime = parseLocalDateTime(draft.endDateTime, 'End Date and Time')
  if (endDateTime.getTime() <= startDateTime.getTime()) {
    throw new Error('End Date and Time must be later than Start Date and Time.')
  }
  if (!draft.meetingFormat) throw new Error('Meeting Format is required.')
  if (!draft.issuesDiscussed.trim()) throw new Error('Write Down What the Staff Said, Not What You Said is required.')

  const payload: Record<string, string | number> = {
    mss_subject: draft.subject.trim(),
    mss_startdateandtime: startDateTime.toISOString(),
    mss_enddateandtime: endDateTime.toISOString(),
    'mss_Representative@odata.bind': `/contacts(${representativeId})`,
    'mss_District@odata.bind': `/mss_districts(${districtId})`,
    mss_meetingformat: draft.meetingFormat,
    mss_writedownwhatthestaffsaidnotwhatyousaid: draft.issuesDiscussed.trim(),
    mss_followupnoteoncethemeetingended: draft.followUpActions.trim(),
    mss_documentsprovided: draft.documentsProvided.trim(),
  }
  if (draft.sentiment) payload.mss_overallsentiment = draft.sentiment
  if (includeOwner) {
    payload['mss_Reportedby@odata.bind'] = `/contacts(${requiredGuid(ownerContactId, 'Authenticated Contact')})`
  }
  return payload
}

export async function createMeetingReport(
  draft: MeetingReportDraft,
  ownerContactId: string,
): Promise<string> {
  const payload = buildMeetingReportPayload(draft, ownerContactId, true)
  let response: Response
  try {
    response = await powerPagesRequest('/_api/mss_meetingreports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof PowerPagesApiError && typeof error.status === 'number') throw error
    throw new MeetingReportCreateOutcomeUnknownError()
  }
  const id = normalizeGuid(response.headers.get('entityid'))
  if (!id) throw new MeetingReportCreateOutcomeUnknownError()
  return id
}

export async function updateMeetingReport(reportId: string, draft: MeetingReportDraft): Promise<void> {
  const id = requiredGuid(reportId, 'Meeting Report')
  await powerPagesRequest(`/_api/mss_meetingreports(${id})`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildMeetingReportPayload(draft, undefined, false)),
  })
}

export async function getMeetingReport(
  reportId: string,
  signal?: AbortSignal,
): Promise<MeetingReportDetails> {
  const id = requiredGuid(reportId, 'Meeting Report')
  const contactProjection = `$select=${CONTACT_SELECT.join(',')}`
  const expand = [
    `mss_MeetingReport_Contact_Staff(${contactProjection})`,
    `mss_MeetingReport_Contact_Volunteers(${contactProjection})`,
  ].join(',')
  const params = new URLSearchParams()
  params.set('$select', REPORT_SELECT.join(','))
  params.set('$expand', expand)

  const record = await powerPagesFetch<ReportApiRecord>(
    `/_api/mss_meetingreports(${id})?${params.toString()}`,
    {
      signal,
      headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' },
    },
  )
  const representativeId = requiredGuid(record._mss_representative_value, 'Representative')
  const resolvedDistrictId = requiredGuid(record._mss_district_value, 'District')
  const staff = Array.isArray(record.mss_MeetingReport_Contact_Staff)
    ? record.mss_MeetingReport_Contact_Staff.map(mapContact)
    : []
  const volunteers = Array.isArray(record.mss_MeetingReport_Contact_Volunteers)
    ? record.mss_MeetingReport_Contact_Volunteers.map(mapContact)
    : []

  return {
    id: requiredGuid(record.mss_meetingreportid, 'Meeting Report'),
    subject: text(record.mss_subject),
    startDateTime: toLocalDateTimeValue(record.mss_startdateandtime)
      || `${text(record.mss_dateofmeeting).slice(0, 10)}T12:00`,
    endDateTime: toLocalDateTimeValue(record.mss_enddateandtime),
    representativeId,
    districtId: resolvedDistrictId,
    meetingFormat: asMeetingFormat(record.mss_meetingformat),
    staffIds: staff.map((contact) => contact.id),
    volunteerIds: volunteers.map((contact) => contact.id),
    issuesDiscussed: text(record.mss_writedownwhatthestaffsaidnotwhatyousaid),
    followUpActions: text(record.mss_followupnoteoncethemeetingended),
    documentsProvided: text(record.mss_documentsprovided),
    sentiment: asSentiment(record.mss_overallsentiment),
    representative: {
      id: representativeId,
      name: text(record['_mss_representative_value@OData.Community.Display.V1.FormattedValue']) || 'Selected representative',
      email: null,
      jobTitle: null,
    },
    district: {
      id: resolvedDistrictId,
      name: text(record['_mss_district_value@OData.Community.Display.V1.FormattedValue']) || 'Selected district',
    },
    staff,
    volunteers,
  }
}

function normalizeMeetingReportsNextLink(nextLink: string): string {
  const baseOrigin = typeof window === 'undefined' ? 'https://powerpages.local' : window.location.origin
  const parsed = new URL(nextLink, baseOrigin)
  if (parsed.origin !== baseOrigin || parsed.pathname.toLowerCase() !== '/_api/mss_meetingreports') {
    throw new Error('Dataverse returned an invalid Meeting Reports continuation link.')
  }
  return `${parsed.pathname}${parsed.search}`
}

function buildMeetingReportsQuery(limit?: number): string {
  const params = new URLSearchParams()
  params.set('$select', [
    'mss_meetingreportid',
    'mss_subject',
    'mss_startdateandtime',
    'mss_dateofmeeting',
    '_mss_representative_value',
    'mss_overallsentiment',
  ].join(','))
  params.set('$orderby', 'mss_startdateandtime desc,mss_meetingreportid asc')
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MEETING_REPORT_PAGE_SIZE) {
      throw new Error(`Meeting Report limits must be between 1 and ${MEETING_REPORT_PAGE_SIZE}.`)
    }
    params.set('$top', String(limit))
  }
  return `?${params.toString()}`
}

export async function getMeetingReportCount(signal?: AbortSignal): Promise<number> {
  const params = new URLSearchParams()
  params.set('$select', 'mss_meetingreportid')
  params.set('$count', 'true')
  params.set('$top', '1')

  const response = await powerPagesFetch<{
    readonly value?: readonly ReportApiRecord[]
    readonly '@odata.count'?: unknown
  }>(`/_api/mss_meetingreports?${params.toString()}`, { signal })
  const count = response['@odata.count']
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('Dataverse returned an invalid Meeting Report count.')
  }
  return count
}

export async function getMeetingReports(
  query: MeetingReportQuery = {},
  signal?: AbortSignal,
): Promise<MeetingReportPage> {
  const requestPath = query.nextLink
    ? normalizeMeetingReportsNextLink(query.nextLink)
    : `/_api/mss_meetingreports${buildMeetingReportsQuery(query.limit)}`

  const response = await powerPagesFetch<{
    readonly value?: readonly ReportApiRecord[]
    readonly '@odata.nextLink'?: string
  }>(
    requestPath,
    {
      signal,
      headers: {
        Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${MEETING_REPORT_PAGE_SIZE}`,
      },
    },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid Meeting Reports response.')

  const reports: MeetingReportSummary[] = response.value.map((record) => {
    const sentiment = asSentiment(record.mss_overallsentiment)
    return {
      id: requiredGuid(record.mss_meetingreportid, 'Meeting Report'),
      subject: text(record.mss_subject) || 'Untitled meeting report',
      representativeName: text(record['_mss_representative_value@OData.Community.Display.V1.FormattedValue']) || 'Not available',
      date: text(record.mss_startdateandtime) || text(record.mss_dateofmeeting),
      sentimentLabel: sentiment ? SENTIMENT_LABELS[sentiment] : 'Not provided',
    }
  })
  const nextLink = typeof response['@odata.nextLink'] === 'string' ? response['@odata.nextLink'] : null
  return { reports, hasNext: Boolean(nextLink), nextLink }
}

export function buildRelationshipOperations(
  original: RelationshipSelection,
  next: RelationshipSelection,
): RelationshipOperation[] {
  const operations: RelationshipOperation[] = []
  const addDiff = (
    relationship: RelationshipOperation['relationship'],
    before: readonly string[],
    after: readonly string[],
  ) => {
    const originalIds = new Set(uniqueGuids(before))
    const nextIds = new Set(uniqueGuids(after))
    for (const contactId of nextIds) {
      if (!originalIds.has(contactId)) operations.push({ action: 'add', relationship, contactId })
    }
    for (const contactId of originalIds) {
      if (!nextIds.has(contactId)) operations.push({ action: 'remove', relationship, contactId })
    }
  }

  addDiff('staff', original.staffIds, next.staffIds)
  addDiff('volunteer', original.volunteerIds, next.volunteerIds)
  return operations
}

function operationKey(operation: RelationshipOperation): string {
  return `${operation.action}:${operation.relationship}:${operation.contactId}`
}

export async function runRelationshipOperations(
  reportId: string,
  requestedOperations: readonly RelationshipOperation[],
): Promise<readonly RelationshipOperation[]> {
  const id = requiredGuid(reportId, 'Meeting Report')
  const unique = new Map<string, RelationshipOperation>()
  for (const operation of requestedOperations) {
    const contactId = normalizeGuid(operation.contactId)
    if (!contactId) continue
    const normalized = { ...operation, contactId }
    unique.set(operationKey(normalized), normalized)
  }

  const operations = [...unique.values()]
  const results = await Promise.allSettled(operations.map((operation) => {
    const schema = RELATIONSHIP_SCHEMAS[operation.relationship]
    const contactUrl = new URL(`/_api/contacts(${operation.contactId})`, window.location.origin).href
    if (operation.action === 'remove') {
      return powerPagesRequest(
        `/_api/mss_meetingreports(${id})/${schema}/$ref?$id=${encodeURIComponent(contactUrl)}`,
        { method: 'DELETE' },
      )
    }

    return powerPagesRequest(`/_api/mss_meetingreports(${id})/${schema}/$ref`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ '@odata.id': contactUrl }),
    })
  }))

  return operations.filter((_, index) => results[index].status === 'rejected')
}
