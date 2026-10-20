import { PowerPagesApiError, PowerPagesDataError, powerPagesFetch } from '../../shared/powerPagesApi'
import type { ContactOption } from '../meetingReports/meetingReportTypes'
import { COVERAGE_OPTIONS, emptyCoverageDraft } from './pressCoverageTypes'
import type { CoverageChoice, CoverageDraft, CoveragePage, CoverageRecord, CoverageVariant } from './pressCoverageTypes'

export const COVERAGE_ENDPOINT = '/_api/serverlogics/press-coverage'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORMATTED = '@OData.Community.Display.V1.FormattedValue'
const TEXT_FIELDS = {
  headlineTitle: 'mss_headlinetitle', mediaOutlet: 'mss_mediaoutlet', datePublishedAired: 'mss_datepublishedaired',
  eventCampaign: 'mss_oiaceventcampaign', personInterviewed: 'mss_personinterviewedquoted', reporter: 'mss_reporterjournalist',
  programSection: 'mss_programsection', articleVideoUrl: 'mss_articlevideourl', summary: 'mss_summary', keyQuotes: 'mss_keyquotes',
  publication: 'mss_publication', headline: 'mss_headline', shortSummary: 'mss_shortsummary',
  publicationDate: 'mss_publicationdate', originalArticleLink: 'mss_originalarticlelink',
} as const
const CHOICE_FIELDS = { coverageType: 'mss_coveragetype', coverageLevel: 'mss_coveragelevel', tone: 'mss_tone', keyTopic: 'mss_keytopic' } as const
const PRESS_FIELDS: readonly (keyof CoverageDraft)[] = ['headlineTitle', 'mediaOutlet', 'datePublishedAired', 'eventCampaign', 'personInterviewed', 'reporter', 'programSection', 'articleVideoUrl', 'summary', 'keyQuotes', 'coverageType', 'coverageLevel', 'tone', 'keyTopic', 'oiacMentioned', 'followUpNeeded', 'relatedContact']
const FEATURED_FIELDS: readonly (keyof CoverageDraft)[] = ['publication', 'headline', 'shortSummary', 'publicationDate', 'originalArticleLink']
type ApiRecord = Record<string, unknown>
type FieldValue = string | number | boolean | null

export class CoverageSaveUncertainError extends Error {
  constructor() {
    super('The save may have completed. Refresh coverage to check before creating another record.')
    this.name = 'CoverageSaveUncertainError'
  }
}

function guid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^\{(.+)\}$/, '$1').toLowerCase()
  return GUID.test(normalized) ? normalized : null
}

function requiredGuid(value: unknown): string {
  const id = guid(value)
  if (!id) throw new PowerPagesDataError('Coverage identifier is invalid.')
  return id
}

function object(value: unknown): ApiRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PowerPagesDataError()
  return value as ApiRecord
}

class CoverageRejectedError extends PowerPagesApiError {}

function parseOnce(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) as unknown } catch { throw new PowerPagesDataError() }
}

export function coverageEnvelope(value: unknown): ApiRecord {
  let envelope = object(parseOnce(value))
  if ('success' in envelope) {
    if (envelope.success !== true) throw new PowerPagesDataError('The coverage server operation could not be completed.')
    envelope = object(parseOnce(envelope.data))
  }
  if (envelope.ok === false) {
    const error = object(envelope.error)
    throw new CoverageRejectedError(typeof error.message === 'string' ? error.message : 'The coverage operation was rejected.', undefined, { code: typeof error.code === 'string' ? error.code : undefined })
  }
  if (envelope.ok !== true) throw new PowerPagesDataError()
  return envelope
}

function string(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function mapRecord(value: unknown): CoverageRecord {
  const raw = object(value)
  const mapped: Record<string, unknown> = { ...emptyCoverageDraft() }
  for (const [key, column] of Object.entries(TEXT_FIELDS)) mapped[key] = string(raw[column])
  // The endpoint normalizes UserLocal columns using verified Dataverse timezonecode 129.
  // Reject raw timestamps instead of shifting or truncating their calendar day in the browser.
  for (const key of ['datePublishedAired', 'publicationDate']) {
    if (mapped[key] && !validDate(String(mapped[key]))) throw new PowerPagesDataError('The coverage date response is invalid.')
  }
  const choiceLabels: Partial<Record<CoverageChoice, string>> = {}
  for (const key of Object.keys(CHOICE_FIELDS) as CoverageChoice[]) {
    const value = raw[CHOICE_FIELDS[key]]
    mapped[key] = typeof value === 'number' && COVERAGE_OPTIONS[key].some((option) => option.value === value) ? value : null
    const label = string(raw[`${CHOICE_FIELDS[key]}${FORMATTED}`])
    if (label) choiceLabels[key] = label
  }
  for (const [key, column] of [['oiacMentioned', 'mss_oiacmentioned'], ['followUpNeeded', 'mss_followupneeded']]) {
    mapped[key] = typeof raw[column] === 'boolean' ? raw[column] : null
  }
  const relatedId = guid(raw._mss_relatedcontact_value)
  mapped.relatedContact = relatedId ? { id: relatedId, name: string(raw[`_mss_relatedcontact_value${FORMATTED}`]) || 'Selected contact', email: null, jobTitle: null } : null
  return {
    ...mapped as CoverageDraft, id: requiredGuid(raw.mss_presscoverageid), isFeatured: raw.mss_isfeatured === true,
    submittedById: guid(raw._mss_submittedby_value), fileId: guid(raw.mss_coveragefile), fileName: string(raw.mss_coveragefile_name) || null, choiceLabels,
  }
}

function continuation(nextLink: string): string {
  const origin = window.location.origin
  let parsed: URL
  try { parsed = new URL(nextLink, origin) } catch { throw new PowerPagesDataError('Invalid coverage continuation link.') }
  const params = [...parsed.searchParams]
  if (parsed.origin !== origin || parsed.pathname !== COVERAGE_ENDPOINT || parsed.hash || parsed.username || parsed.password
    || params.length !== 1 || params[0][0] !== 'page' || !/^[1-9]\d*$/.test(params[0][1]) || !Number.isSafeInteger(Number(params[0][1]))) {
    throw new PowerPagesDataError('Invalid coverage continuation link.')
  }
  return `${parsed.pathname}${parsed.search}`
}

export async function getCoveragePage(query: { readonly nextLink?: string | null } = {}, signal?: AbortSignal): Promise<CoveragePage> {
  const path = query.nextLink ? continuation(query.nextLink) : `${COVERAGE_ENDPOINT}?page=1`
  const body = coverageEnvelope(await powerPagesFetch<unknown>(path, { signal }))
  if (!Array.isArray(body.records) || body.records.length > 15 || (body.nextLink !== null && typeof body.nextLink !== 'string')) throw new PowerPagesDataError()
  return { records: body.records.map(mapRecord), nextLink: typeof body.nextLink === 'string' ? continuation(body.nextLink) : null }
}

export async function getCoverage(id: string, signal?: AbortSignal): Promise<CoverageRecord> {
  const requestedId = requiredGuid(id)
  const body = coverageEnvelope(await powerPagesFetch<unknown>(`${COVERAGE_ENDPOINT}?id=${requestedId}`, { signal }))
  const record = mapRecord(body.record)
  if (record.id !== requestedId) throw new PowerPagesDataError()
  return record
}

export async function searchCoverageContacts(search: string, signal?: AbortSignal): Promise<readonly ContactOption[]> {
  const params = new URLSearchParams({ '$select': 'contactid,fullname', '$orderby': 'fullname asc,contactid asc', '$top': '15' })
  const term = search.trim().slice(0, 150)
  if (term) params.set('$filter', `contains(fullname,'${term.replace(/'/g, "''")}')`)
  const body = object(await powerPagesFetch<unknown>(`/_api/contacts?${params.toString()}`, { signal }))
  if (!Array.isArray(body.value)) throw new PowerPagesDataError()
  return body.value.slice(0, 15).map((value: unknown) => {
    const contact = object(value)
    return { id: requiredGuid(contact.contactid), name: string(contact.fullname) || 'Unnamed contact', email: null, jobTitle: null }
  })
}

export function canEditCoverage(record: CoverageRecord, contactId: string | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || Boolean(guid(contactId) && guid(record.submittedById) === guid(contactId))
}

function label(record: CoverageRecord, field: CoverageChoice): string {
  return record.choiceLabels?.[field] || COVERAGE_OPTIONS[field].find((option) => option.value === record[field])?.label || '—'
}

export function coverageListing(record: CoverageRecord) {
  return {
    headline: (record.isFeatured ? record.headline || record.headlineTitle : record.headlineTitle || record.headline) || '—',
    mediaOutlet: (record.isFeatured ? record.publication || record.mediaOutlet : record.mediaOutlet || record.publication) || '—',
    date: record.isFeatured ? record.publicationDate || record.datePublishedAired : record.datePublishedAired || record.publicationDate,
    coverageType: record.isFeatured ? 'Featured Coverage' : label(record, 'coverageType'),
    tone: label(record, 'tone'), coverageLevel: label(record, 'coverageLevel'),
  }
}

export function displayCoverageDate(value: string): string {
  if (!validDate(value)) return '—'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function fieldValue(key: keyof CoverageDraft, draft: CoverageDraft): FieldValue {
  if (key === 'relatedContact') return draft.relatedContact ? requiredGuid(draft.relatedContact.id) : null
  const value = draft[key]
  if (key in CHOICE_FIELDS) {
    if (value !== null && !COVERAGE_OPTIONS[key as CoverageChoice].some((option) => option.value === value)) throw new Error('Invalid coverage choice.')
    return value as number | null
  }
  if (typeof value !== 'string') return value as boolean | null
  const normalized = value.trim()
  if (key !== 'datePublishedAired' && key !== 'publicationDate' && normalized.length > (key === 'headlineTitle' ? 850 : 100)) throw new Error(`${key} must be ${key === 'headlineTitle' ? 850 : 100} characters or fewer.`)
  if ((key === 'datePublishedAired' || key === 'publicationDate') && normalized && !validDate(normalized)) throw new Error('A valid coverage date is required.')
  if ((key === 'articleVideoUrl' || key === 'originalArticleLink') && normalized) {
    let url: URL
    try { url = new URL(normalized) } catch { throw new Error('Use an HTTP(S) article URL.') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) article URL.')
  }
  return normalized || null
}

function fields(variant: CoverageVariant, draft: CoverageDraft, original?: CoverageRecord): Record<string, FieldValue> {
  if (variant !== 'press' && variant !== 'featured') throw new Error('Invalid coverage variant.')
  const result: Record<string, FieldValue> = {}
  for (const key of variant === 'press' ? PRESS_FIELDS : FEATURED_FIELDS) {
    if (original && (key === 'relatedContact' ? guid(draft.relatedContact?.id) === guid(original.relatedContact?.id) : draft[key] === original[key])) continue
    const column = key in TEXT_FIELDS ? TEXT_FIELDS[key as keyof typeof TEXT_FIELDS]
      : key in CHOICE_FIELDS ? CHOICE_FIELDS[key as CoverageChoice]
        : key === 'relatedContact' ? 'mss_relatedcontact' : key === 'oiacMentioned' ? 'mss_oiacmentioned' : 'mss_followupneeded'
    result[column] = fieldValue(key, draft)
  }
  return result
}

export async function createCoverage(variant: CoverageVariant, draft: CoverageDraft): Promise<{ id: string }> {
  const payload = { operation: 'create', variant, fields: fields(variant, draft) }
  try {
    const body = coverageEnvelope(await powerPagesFetch<unknown>(COVERAGE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
    return { id: requiredGuid(body.id) }
  } catch (error) {
    // Only known pre-write failures make a second create safe. A server error
    // can arrive after Dataverse committed the record, even inside HTTP 200.
    const definiteRejection = error instanceof CoverageRejectedError
      ? ['validation', 'unauthenticated', 'forbidden'].includes(error.code?.toLowerCase() ?? '')
      : error instanceof PowerPagesApiError && [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(error.status ?? 0)
    if (definiteRejection) throw error
    throw new CoverageSaveUncertainError()
  }
}

export async function updateCoverage(id: string, variant: CoverageVariant, draft: CoverageDraft, original: CoverageRecord): Promise<{ id: string }> {
  const normalizedId = requiredGuid(id)
  if (normalizedId !== requiredGuid(original.id)) throw new Error('Coverage record does not match.')
  if (original.isFeatured !== (variant === 'featured')) throw new Error('Coverage variant cannot be changed.')
  const payload = { operation: 'update', id: normalizedId, variant, fields: fields(variant, draft, original) }
  const body = coverageEnvelope(await powerPagesFetch<unknown>(COVERAGE_ENDPOINT, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  const resultId = requiredGuid(body.id)
  if (resultId !== normalizedId) throw new PowerPagesDataError()
  return { id: resultId }
}
