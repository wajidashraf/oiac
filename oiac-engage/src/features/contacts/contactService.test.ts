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

  test('builds an exact district-scoped second-page query', () => {
    const query = buildContactsQuery({ districtId: DISTRICT_ID, page: 2, search: '' })
    const params = new URLSearchParams(query.slice(1))

    expect(params.get('$select')).toBe(
      'contactid,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,_mss_district_value',
    )
    expect(params.get('$filter')).toBe(`_mss_district_value eq ${DISTRICT_ID}`)
    expect(params.get('$orderby')).toBe('fullname asc,contactid asc')
    expect(params.get('$skip')).toBe('15')
    expect(params.get('$top')).toBe('16')
  })

  test('escapes apostrophes and searches all required fields inside the district boundary', () => {
    const query = buildContactsQuery({ districtId: DISTRICT_ID, page: 1, search: "  O'Connor & Sons  " })
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

  test('rejects invalid identifiers and page numbers before a request can be built', () => {
    expect(() => buildContactsQuery({ districtId: 'not-a-guid', page: 1, search: '' }))
      .toThrow('A valid district identifier is required.')
    expect(() => buildContactsQuery({ districtId: DISTRICT_ID, page: 0, search: '' }))
      .toThrow('The Contacts page number must be at least 1.')
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

  test('displays fifteen records and uses the sixteenth only to enable Next', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: Array.from({ length: 16 }, (_, index) => makeContact(index + 1)) })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, page: 1, search: '' })

    expect(result.contacts).toHaveLength(CONTACT_PAGE_SIZE)
    expect(result.contacts[CONTACT_PAGE_SIZE - 1]?.fullName).toBe('Contact 15')
    expect(result.hasNext).toBe(true)
    expect(powerPagesFetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/_api\/contacts\?/),
      { signal: undefined },
    )
  })

  test('disables Next when the server returns no look-ahead record', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: Array.from({ length: 15 }, (_, index) => makeContact(index + 1)) })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, page: 1, search: '' })

    expect(result.contacts).toHaveLength(15)
    expect(result.hasNext).toBe(false)
  })

  test('maps missing Dataverse values to null display values', async () => {
    powerPagesFetchMock.mockResolvedValue({
      value: [{ contactid: CONTACT_ID, _mss_district_value: DISTRICT_ID } satisfies ContactRecord],
    })

    const result = await getDistrictContacts({ districtId: DISTRICT_ID, page: 1, search: '' })

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
