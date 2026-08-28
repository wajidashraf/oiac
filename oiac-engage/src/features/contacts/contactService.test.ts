import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import {
  CONTACT_PAGE_SIZE,
  buildContactsQuery,
  getDistrictContacts,
  getLoggedInUserDistrict,
} from './contactService'
import type { ContactRecord } from './contactTypes'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
}))

const powerPagesFetchMock = vi.mocked(powerPagesFetch)
const DISTRICT_ID = '367d7420-d8a2-f111-b8da-7ced8d70f293'
const CONTACT_ID = '20f9c936-6740-451e-9470-28a3c83c9909'

function makeContact(index: number): ContactRecord {
  return {
    contactid: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    fullname: `Contact ${index}`,
    emailaddress1: `contact${index}@example.org`,
    mobilephone: `202-555-${String(index).padStart(4, '0')}`,
    address1_city: 'Washington',
    address1_stateorprovince: 'DC',
    _mss_district_value: DISTRICT_ID,
  }
}

describe('Contact Web API service', () => {
  beforeEach(() => {
    powerPagesFetchMock.mockReset()
  })

  test('builds a district-scoped cursor query without unsupported offset pagination', () => {
    const query = buildContactsQuery({ districtId: DISTRICT_ID, search: '' })
    const params = new URLSearchParams(query.slice(1))

    expect(params.get('$select')).toBe(
      'contactid,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,_mss_district_value',
    )
    expect(params.get('$filter')).toBe(`_mss_district_value eq ${DISTRICT_ID}`)
    expect(params.get('$orderby')).toBe('fullname asc,contactid asc')
    expect(params.get('$count')).toBe('true')
    expect(params.has('$skip')).toBe(false)
    expect(params.has('$top')).toBe(false)
  })

  test('escapes apostrophes and searches all required fields inside the district boundary', () => {
    const query = buildContactsQuery({ districtId: DISTRICT_ID, search: "  O'Connor & Sons  " })
    const filter = new URLSearchParams(query.slice(1)).get('$filter')

    expect(filter).toBe(
      `_mss_district_value eq ${DISTRICT_ID} and (`
      + "contains(fullname,'O''Connor & Sons') or "
      + "contains(emailaddress1,'O''Connor & Sons') or "
      + "contains(mobilephone,'O''Connor & Sons') or "
      + "contains(address1_city,'O''Connor & Sons') or "
      + "contains(address1_stateorprovince,'O''Connor & Sons'))",
    )
  })

  test('rejects an invalid district identifier before a request can be built', () => {
    expect(() => buildContactsQuery({ districtId: 'not-a-guid', search: '' }))
      .toThrow('A valid district identifier is required.')
  })

  test('retrieves only the district lookup from the signed-in Contact', async () => {
    const signal = new AbortController().signal
    powerPagesFetchMock.mockResolvedValue({
      contactid: CONTACT_ID,
      _mss_district_value: DISTRICT_ID.toUpperCase(),
    })

    await expect(getLoggedInUserDistrict(CONTACT_ID.toUpperCase(), signal)).resolves.toBe(DISTRICT_ID)
    expect(powerPagesFetchMock).toHaveBeenCalledWith(
      `/_api/contacts(${CONTACT_ID})?$select=_mss_district_value`,
      { signal },
    )
  })

  test('returns null when the signed-in Contact has no district', async () => {
    powerPagesFetchMock.mockResolvedValue({ contactid: CONTACT_ID })

    await expect(getLoggedInUserDistrict(CONTACT_ID)).resolves.toBeNull()
  })

  test('rejects an invalid portal Contact identifier before requesting Dataverse', async () => {
    await expect(getLoggedInUserDistrict('contact-001')).rejects.toThrow(
      'The Power Pages session did not provide a valid Contact identifier.',
    )
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })

  test('requests a fifteen-record server page and exposes its continuation cursor', async () => {
    const nextLink = `https://oiac-engage.powerappsportals.com/_api/contacts?%24skiptoken=opaque-page-2`
    powerPagesFetchMock.mockResolvedValue({
      value: Array.from({ length: 15 }, (_, index) => makeContact(index + 1)),
      '@odata.nextLink': nextLink,
    })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, search: '' })

    expect(result.contacts).toHaveLength(CONTACT_PAGE_SIZE)
    expect(result.contacts[CONTACT_PAGE_SIZE - 1]?.fullName).toBe('Contact 15')
    expect(result.hasNext).toBe(true)
    expect(result.nextLink).toBe(nextLink)
    expect(powerPagesFetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/_api\/contacts\?/),
      {
        signal: undefined,
        headers: { Prefer: `odata.maxpagesize=${CONTACT_PAGE_SIZE}` },
      },
    )
  })

  test('uses the server continuation link directly for the next page', async () => {
    const nextLink = '/_api/contacts?%24skiptoken=opaque-page-2'
    powerPagesFetchMock.mockResolvedValue({ value: [makeContact(16)] })

    await getDistrictContacts({ districtId: DISTRICT_ID, search: '', nextLink })

    expect(powerPagesFetchMock).toHaveBeenCalledWith(nextLink, {
      signal: undefined,
      headers: { Prefer: `odata.maxpagesize=${CONTACT_PAGE_SIZE}` },
    })
  })

  test('disables Next when the server returns no continuation link', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: Array.from({ length: 15 }, (_, index) => makeContact(index + 1)) })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, search: '' })

    expect(result.contacts).toHaveLength(15)
    expect(result.hasNext).toBe(false)
    expect(result.nextLink).toBeNull()
  })

  test('maps missing Dataverse values to null display values', async () => {
    powerPagesFetchMock.mockResolvedValue({
      value: [{ contactid: CONTACT_ID, _mss_district_value: DISTRICT_ID } satisfies ContactRecord],
    })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, search: '' })

    expect(result.contacts[0]).toEqual({
      id: CONTACT_ID,
      fullName: null,
      email: null,
      mobilePhone: null,
      city: null,
      stateOrProvince: null,
      districtId: DISTRICT_ID,
    })
  })
})
