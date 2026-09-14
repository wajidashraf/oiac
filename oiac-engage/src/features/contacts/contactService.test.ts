import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import {
  CONTACT_PAGE_SIZE,
  buildAdminContactsQuery,
  buildContactsQuery,
  getAdminVolunteerContacts,
  getDistrictContacts,
  getLoggedInUserDistrict,
  updateAdminContact,
} from './contactService'
import type { AdminContactUpdate, ContactRecord } from './contactTypes'

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
    _mss_district_value: DISTRICT_ID,
    '_mss_district_value@OData.Community.Display.V1.FormattedValue': 'District 1',
  }
}

const ADMIN_CONTACT: ContactRecord = {
  contactid: CONTACT_ID.toUpperCase(),
  firstname: ' Sara ',
  lastname: ' Rahimi ',
  emailaddress1: ' sara@example.org ',
  jobtitle: ' Volunteer Coordinator ',
  mobilephone: ' 202-555-0100 ',
  address1_city: ' Washington ',
  address1_stateorprovince: ' DC ',
  address1_postalcode: ' 20001 ',
  _mss_district_value: DISTRICT_ID.toUpperCase(),
  '_mss_district_value@OData.Community.Display.V1.FormattedValue': ' District 1 ',
}

const ADMIN_UPDATE: AdminContactUpdate = {
  firstName: ' Sara ',
  lastName: ' Rahimi ',
  jobTitle: ' Volunteer Coordinator ',
  mobilePhone: '   ',
  city: ' Washington ',
  stateOrProvince: ' DC ',
  postalCode: ' 20001 ',
  districtId: DISTRICT_ID.toUpperCase(),
}

describe('Contact Web API service', () => {
  beforeEach(() => {
    powerPagesFetchMock.mockReset()
  })

  test('builds a district-scoped cursor query without unsupported offset pagination', () => {
    const query = buildContactsQuery({ districtId: DISTRICT_ID, search: '' })
    const params = new URLSearchParams(query.slice(1))

    expect(params.get('$select')).toBe(
      'contactid,fullname,emailaddress1,mobilephone,address1_city,_mss_district_value',
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
      + "contains(address1_city,'O''Connor & Sons'))",
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
        headers: {
          Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${CONTACT_PAGE_SIZE}`,
        },
      },
    )
    expect(result.contacts[0]?.districtName).toBe('District 1')
  })

  test('uses the server continuation link directly for the next page', async () => {
    const nextLink = '/_api/contacts?%24skiptoken=opaque-page-2'
    powerPagesFetchMock.mockResolvedValue({ value: [makeContact(16)] })

    await getDistrictContacts({ districtId: DISTRICT_ID, search: '', nextLink })

    expect(powerPagesFetchMock).toHaveBeenCalledWith(nextLink, {
      signal: undefined,
      headers: {
        Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${CONTACT_PAGE_SIZE}`,
      },
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
      firstName: null,
      lastName: null,
      email: null,
      jobTitle: null,
      mobilePhone: null,
      city: null,
      stateOrProvince: null,
      postalCode: null,
      districtName: null,
      districtId: DISTRICT_ID,
    })
  })

  test('builds a bounded volunteer query for administrators', () => {
    const query = buildAdminContactsQuery({ search: '' })
    const params = new URLSearchParams(query.slice(1))

    expect(params.get('$select')).toBe(
      'contactid,address1_city,address1_stateorprovince,address1_postalcode,'
      + '_mss_district_value,emailaddress1,firstname,jobtitle,lastname,mobilephone',
    )
    expect(params.get('$filter')).toBe("jobtitle eq 'Volunteer'")
    expect(params.get('$filter')).not.toContain("contains(jobtitle,'volunteer')")
    expect(params.get('$orderby')).toBe('lastname asc,firstname asc,contactid asc')
    expect(params.has('$skip')).toBe(false)
    expect(params.has('$top')).toBe(false)
  })

  test('keeps administrator search inside the volunteer boundary and escapes apostrophes', () => {
    const query = buildAdminContactsQuery({ search: " O'Connor " })
    const filter = new URLSearchParams(query.slice(1)).get('$filter')

    expect(filter).toBe(
      "jobtitle eq 'Volunteer' and ("
      + "contains(firstname,'O''Connor') or "
      + "contains(lastname,'O''Connor') or "
      + "contains(emailaddress1,'O''Connor') or "
      + "contains(mobilephone,'O''Connor') or "
      + "contains(jobtitle,'O''Connor') or "
      + "contains(address1_city,'O''Connor') or "
      + "contains(address1_stateorprovince,'O''Connor') or "
      + "contains(address1_postalcode,'O''Connor'))",
    )
    expect(filter).not.toContain("contains(jobtitle,'volunteer')")
  })

  test('loads and maps an administrator volunteer page with the existing page preference', async () => {
    const signal = new AbortController().signal
    const nextLink = '/_api/contacts?%24skiptoken=admin-page-2'
    powerPagesFetchMock.mockResolvedValue({ value: [ADMIN_CONTACT], '@odata.nextLink': nextLink })

    const result = await getAdminVolunteerContacts({ search: '' }, signal)

    expect(result.contacts[0]).toEqual({
      id: CONTACT_ID,
      fullName: 'Sara Rahimi',
      firstName: 'Sara',
      lastName: 'Rahimi',
      email: 'sara@example.org',
      jobTitle: 'Volunteer Coordinator',
      mobilePhone: '202-555-0100',
      city: 'Washington',
      stateOrProvince: 'DC',
      postalCode: '20001',
      districtName: 'District 1',
      districtId: DISTRICT_ID,
    })
    expect(result).toMatchObject({ hasNext: true, nextLink })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/_api\/contacts\?/), {
      signal,
      headers: {
        Prefer: `odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=${CONTACT_PAGE_SIZE}`,
      },
    })
  })

  test('uses only safe Contacts continuation links for administrator pages', async () => {
    const nextLink = '/_api/contacts?%24skiptoken=admin-page-2'
    powerPagesFetchMock.mockResolvedValue({ value: [] })

    await getAdminVolunteerContacts({ search: '', nextLink })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(nextLink, expect.any(Object))

    await expect(getAdminVolunteerContacts({
      search: '',
      nextLink: 'https://attacker.example/_api/contacts?$skiptoken=stolen',
    })).rejects.toThrow('Dataverse returned an invalid Contacts continuation link.')
    await expect(getAdminVolunteerContacts({
      search: '',
      nextLink: '/_api/accounts?$skiptoken=wrong-table',
    })).rejects.toThrow('Dataverse returned an invalid Contacts continuation link.')
    expect(powerPagesFetchMock).toHaveBeenCalledTimes(1)
  })

  test('rejects malformed administrator collection data and invalid Contact identifiers', async () => {
    powerPagesFetchMock.mockResolvedValueOnce({ value: null })
    await expect(getAdminVolunteerContacts({ search: '' })).rejects.toThrow(
      'Dataverse returned an invalid Contacts response.',
    )

    powerPagesFetchMock.mockResolvedValueOnce({ value: [{ ...ADMIN_CONTACT, contactid: 'bad-id' }] })
    await expect(getAdminVolunteerContacts({ search: '' })).rejects.toThrow(
      'Dataverse returned a Contact without a valid identifier.',
    )
  })

  test('updates only approved administrator fields with normalized values', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)

    await updateAdminContact(CONTACT_ID.toUpperCase(), ADMIN_UPDATE)

    expect(powerPagesFetchMock).toHaveBeenCalledWith(`/_api/contacts(${CONTACT_ID})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '*' },
      body: JSON.stringify({
        firstname: 'Sara',
        lastname: 'Rahimi',
        jobtitle: 'Volunteer Coordinator',
        mobilephone: null,
        address1_city: 'Washington',
        address1_stateorprovince: 'DC',
        address1_postalcode: '20001',
        'mss_District@odata.bind': `/mss_districts(${DISTRICT_ID})`,
      }),
    })
    const request = powerPagesFetchMock.mock.calls[0]?.[1]
    expect(request?.body).not.toContain('emailaddress1')
    expect(request?.body).not.toContain('contactid')
    expect(request?.body).not.toContain('fullname')
  })

  test('clears optional values and District with explicit nulls', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)

    await updateAdminContact(CONTACT_ID, {
      ...ADMIN_UPDATE,
      firstName: ' ',
      jobTitle: '',
      city: '',
      stateOrProvince: '',
      postalCode: '',
      districtId: null,
    })

    expect(JSON.parse(String(powerPagesFetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      firstname: null,
      lastname: 'Rahimi',
      jobtitle: null,
      mobilephone: null,
      address1_city: null,
      address1_stateorprovince: null,
      address1_postalcode: null,
      'mss_District@odata.bind': null,
    })
  })

  test('rejects invalid update identifiers and a blank Last Name before requesting Dataverse', async () => {
    await expect(updateAdminContact('bad-id', ADMIN_UPDATE)).rejects.toThrow(
      'A valid Contact identifier is required.',
    )
    await expect(updateAdminContact(CONTACT_ID, { ...ADMIN_UPDATE, districtId: 'bad-id' })).rejects.toThrow(
      'A valid district identifier is required.',
    )
    await expect(updateAdminContact(CONTACT_ID, { ...ADMIN_UPDATE, lastName: '   ' })).rejects.toThrow(
      'Last Name is required.',
    )
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })
})
