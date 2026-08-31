import { powerPagesFetch } from '../../shared/powerPagesApi'
import type { ContactPage, ContactQuery, ContactRecord, DistrictContact } from './contactTypes'

export const CONTACT_PAGE_SIZE = 15

const CONTACT_SELECT = [
  'contactid',
  'fullname',
  'emailaddress1',
  'mobilephone',
  'address1_city',
  '_mss_district_value',
] as const

const SEARCH_FIELDS = [
  'fullname',
  'emailaddress1',
  'mobilephone',
  'address1_city',
] as const

const CONTACT_PREFER = `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${CONTACT_PAGE_SIZE}`

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeGuid(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^\{(.+)\}$/, '$1').toLowerCase() ?? ''
  return GUID_PATTERN.test(normalized) ? normalized : null
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function mapContact(record: ContactRecord, districtId: string): DistrictContact {
  const contactId = normalizeGuid(record.contactid)
  if (!contactId) throw new Error('Dataverse returned a Contact without a valid identifier.')

  return {
    id: contactId,
    fullName: textOrNull(record.fullname),
    email: textOrNull(record.emailaddress1),
    mobilePhone: textOrNull(record.mobilephone),
    city: textOrNull(record.address1_city),
    districtName: textOrNull(
      record['_mss_district_value@OData.Community.Display.V1.FormattedValue'],
    ),
    districtId: normalizeGuid(record._mss_district_value) ?? districtId,
  }
}

export function buildContactsQuery({ districtId, search }: ContactQuery): string {
  const normalizedDistrictId = normalizeGuid(districtId)
  if (!normalizedDistrictId) throw new Error('A valid district identifier is required.')

  const districtFilter = `_mss_district_value eq ${normalizedDistrictId}`
  const normalizedSearch = search.trim()
  const filter = normalizedSearch
    ? `${districtFilter} and (${SEARCH_FIELDS
      .map((field) => `contains(${field},'${escapeODataString(normalizedSearch)}')`)
      .join(' or ')})`
    : districtFilter

  const params = new URLSearchParams()
  params.set('$select', CONTACT_SELECT.join(','))
  params.set('$filter', filter)
  params.set('$orderby', 'fullname asc,contactid asc')
  params.set('$count', 'true')
  return `?${params.toString()}`
}

function normalizeContactsNextLink(nextLink: string): string {
  const baseOrigin = typeof window === 'undefined' ? 'https://powerpages.local' : window.location.origin
  const parsed = new URL(nextLink, baseOrigin)
  if (parsed.origin !== baseOrigin || parsed.pathname.toLowerCase() !== '/_api/contacts') {
    throw new Error('Dataverse returned an invalid Contacts continuation link.')
  }
  return `${parsed.pathname}${parsed.search}`
}

export async function getLoggedInUserDistrict(
  contactId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const normalizedContactId = normalizeGuid(contactId)
  if (!normalizedContactId) {
    throw new Error('The Power Pages session did not provide a valid Contact identifier.')
  }

  const record = await powerPagesFetch<Pick<ContactRecord, '_mss_district_value'>>(
    `/_api/contacts(${normalizedContactId})?$select=_mss_district_value`,
    { signal },
  )
  const districtValue = record._mss_district_value
  if (districtValue == null || districtValue.trim() === '') return null

  const districtId = normalizeGuid(districtValue)
  if (!districtId) throw new Error('Dataverse returned an invalid district identifier.')
  return districtId
}

export async function getDistrictContacts(
  query: ContactQuery,
  signal?: AbortSignal,
): Promise<ContactPage> {
  const normalizedDistrictId = normalizeGuid(query.districtId)
  if (!normalizedDistrictId) throw new Error('A valid district identifier is required.')

  const requestPath = query.nextLink
    ? normalizeContactsNextLink(query.nextLink)
    : `/_api/contacts${buildContactsQuery({ ...query, districtId: normalizedDistrictId })}`
  const response = await powerPagesFetch<{
    readonly value: readonly ContactRecord[]
    readonly '@odata.nextLink'?: string
  }>(
    requestPath,
    {
      signal,
      headers: { Prefer: CONTACT_PREFER },
    },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid Contacts response.')

  const nextLink = typeof response['@odata.nextLink'] === 'string'
    ? response['@odata.nextLink']
    : null

  return {
    contacts: response.value.map((record) => mapContact(record, normalizedDistrictId)),
    hasNext: Boolean(nextLink),
    nextLink,
  }
}
