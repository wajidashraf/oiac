import { PowerPagesApiError, powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import type {
  ContactLookupKind,
  ContactOption,
  DistrictOption,
  MeetingFormat,
  MeetingReportDetails,
  MeetingReportDraft,
  MeetingReportProfile,
  MeetingReportSummary,
  MeetingSentiment,
  RelationshipOperation,
  RelationshipSelection,
} from './meetingReportTypes'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOOKUP_LIMIT = 15

const CONTACT_SELECT = ['contactid', 'fullname', 'emailaddress1', 'jobtitle'] as const
const REPORT_SELECT = [
  'mss_meetingreportid',
  'mss_subject',
  'mss_dateofmeeting',
  '_mss_representative_value',
  '_mss_district_value',
  'mss_meetingformat',
  'mss_writedownwhatthestaffsaidnotwhatyousaid',
  'mss_followupnoteoncethemeetingended',
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
  readonly mss_dateofmeeting?: unknown
  readonly _mss_representative_value?: unknown
  readonly '_mss_representative_value@OData.Community.Display.V1.FormattedValue'?: unknown
  readonly _mss_district_value?: unknown
  readonly '_mss_district_value@OData.Community.Display.V1.FormattedValue'?: unknown
  readonly mss_meetingformat?: unknown
  readonly mss_writedownwhatthestaffsaidnotwhatyousaid?: unknown
  readonly mss_followupnoteoncethemeetingended?: unknown
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
  const id = requiredGuid(contactId, 'Authenticated Contact')
  const contact = await powerPagesFetch<ContactApiRecord>(
    `/_api/contacts(${id})?$select=contactid,fullname,emailaddress1,address1_city,address1_stateorprovince,_mss_district_value`,
    { signal },
  )
  const resolvedContactId = requiredGuid(contact.contactid, 'Authenticated Contact')
  const resolvedDistrictId = normalizeGuid(contact._mss_district_value)
  let districtName = ''

  if (resolvedDistrictId) {
    const district = await powerPagesFetch<DistrictApiRecord>(
      `/_api/mss_districts(${resolvedDistrictId})?$select=mss_districtid,mss_number`,
      { signal },
    )
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
  if (!draft.subject.trim()) throw new Error('Meeting Title is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) throw new Error('A valid Date of Meeting is required.')
  if (!draft.meetingFormat) throw new Error('Meeting Format is required.')
  if (!draft.issuesDiscussed.trim()) throw new Error('Issues Discussed is required.')

  const payload: Record<string, string | number> = {
    mss_subject: draft.subject.trim(),
    mss_dateofmeeting: new Date(`${draft.date}T12:00:00.000Z`).toISOString(),
    'mss_Representative@odata.bind': `/contacts(${representativeId})`,
    'mss_District@odata.bind': `/mss_districts(${districtId})`,
    mss_meetingformat: draft.meetingFormat,
    mss_writedownwhatthestaffsaidnotwhatyousaid: draft.issuesDiscussed.trim(),
    mss_followupnoteoncethemeetingended: draft.followUpActions.trim(),
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
    date: text(record.mss_dateofmeeting).slice(0, 10),
    representativeId,
    districtId: resolvedDistrictId,
    meetingFormat: asMeetingFormat(record.mss_meetingformat),
    staffIds: staff.map((contact) => contact.id),
    volunteerIds: volunteers.map((contact) => contact.id),
    issuesDiscussed: text(record.mss_writedownwhatthestaffsaidnotwhatyousaid),
    outcomesNextSteps: '',
    followUpActions: text(record.mss_followupnoteoncethemeetingended),
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

export async function getMeetingReports(signal?: AbortSignal): Promise<readonly MeetingReportSummary[]> {
  const params = new URLSearchParams()
  params.set('$select', [
    'mss_meetingreportid',
    'mss_subject',
    'mss_dateofmeeting',
    '_mss_representative_value',
    'mss_overallsentiment',
  ].join(','))
  params.set('$orderby', 'mss_dateofmeeting desc,mss_meetingreportid asc')
  params.set('$top', '100')

  const response = await powerPagesFetch<{ readonly value?: readonly ReportApiRecord[] }>(
    `/_api/mss_meetingreports?${params.toString()}`,
    {
      signal,
      headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' },
    },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid Meeting Reports response.')

  return response.value.map((record) => {
    const sentiment = asSentiment(record.mss_overallsentiment)
    return {
      id: requiredGuid(record.mss_meetingreportid, 'Meeting Report'),
      subject: text(record.mss_subject) || 'Untitled meeting report',
      representativeName: text(record['_mss_representative_value@OData.Community.Display.V1.FormattedValue']) || 'Not available',
      date: text(record.mss_dateofmeeting).slice(0, 10),
      sentimentLabel: sentiment ? SENTIMENT_LABELS[sentiment] : 'Not provided',
    }
  })
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
