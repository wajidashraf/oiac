import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import {
  getMyProfile,
  normalizeProfileContactId,
  updateMyProfile,
} from './profileService'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
}))

const powerPagesFetchMock = vi.mocked(powerPagesFetch)
const CONTACT_ID = '11111111-1111-4111-8111-111111111111'

describe('profileService', () => {
  beforeEach(() => {
    powerPagesFetchMock.mockReset()
  })

  test('normalizes a Power Pages Contact identifier', () => {
    expect(normalizeProfileContactId(`{${CONTACT_ID.toUpperCase()}}`)).toBe(CONTACT_ID)
    expect(normalizeProfileContactId('not-a-contact-id')).toBeNull()
    expect(normalizeProfileContactId(undefined)).toBeNull()
  })

  test('loads all profile fields and the formatted District for the signed-in Contact', async () => {
    const signal = new AbortController().signal
    powerPagesFetchMock.mockResolvedValue({
      contactid: CONTACT_ID,
      firstname: 'Ava',
      lastname: 'Rahimi',
      emailaddress1: ' ava@example.org ',
      mobilephone: ' 555-0100 ',
      address1_city: null,
      address1_stateorprovince: 'Virginia',
      address1_postalcode: ' 22201 ',
      _mss_district_value: '22222222-2222-4222-8222-222222222222',
      '_mss_district_value@OData.Community.Display.V1.FormattedValue': 'District 12',
    })

    await expect(getMyProfile(CONTACT_ID, signal)).resolves.toEqual({
      firstName: 'Ava',
      lastName: 'Rahimi',
      email: 'ava@example.org',
      mobilePhone: '555-0100',
      city: '',
      state: 'Virginia',
      postalCode: '22201',
      districtId: '22222222-2222-4222-8222-222222222222',
      districtName: 'District 12',
    })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(
      `/_api/contacts(${CONTACT_ID})?$select=contactid,firstname,lastname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,address1_postalcode,_mss_district_value`,
      {
        signal,
        headers: {
          Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        },
      },
    )
  })

  test('rejects an invalid Contact identifier without calling the Web API', async () => {
    await expect(getMyProfile('contact-001')).rejects.toThrow(
      'The Power Pages session did not provide a valid Contact identifier.',
    )
    await expect(updateMyProfile('contact-001', {
      firstName: 'Ava',
      lastName: 'Rahimi',
      email: 'ava@example.org',
      mobilePhone: '',
      city: '',
      state: '',
      postalCode: '',
      districtId: null,
      districtName: '',
    }, null)).rejects.toThrow('The Power Pages session did not provide a valid Contact identifier.')
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })

  test('shows a safe District label when Dataverse omits the formatted value', async () => {
    powerPagesFetchMock.mockResolvedValue({
      contactid: CONTACT_ID,
      _mss_district_value: '22222222-2222-4222-8222-222222222222',
    })

    await expect(getMyProfile(CONTACT_ID)).resolves.toMatchObject({
      districtId: '22222222-2222-4222-8222-222222222222',
      districtName: 'Selected district',
    })
  })

  test('updates editable fields and sets District when the Contact has no stored District', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)

    await expect(updateMyProfile(`{${CONTACT_ID}}`, {
      firstName: '  Ava  ',
      lastName: ' Rahimi ',
      email: ' ava@example.org ',
      mobilePhone: ' 555-0100 ',
      city: '  ',
      state: ' Virginia ',
      postalCode: ' 22201 ',
      districtId: '22222222-2222-4222-8222-222222222222',
      districtName: ' District 12 ',
    }, null)).resolves.toEqual({
      firstName: 'Ava',
      lastName: 'Rahimi',
      email: 'ava@example.org',
      mobilePhone: '555-0100',
      city: '',
      state: 'Virginia',
      postalCode: '22201',
      districtId: '22222222-2222-4222-8222-222222222222',
      districtName: 'District 12',
    })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(`/_api/contacts(${CONTACT_ID})`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '*',
      },
      body: JSON.stringify({
        firstname: 'Ava',
        lastname: 'Rahimi',
        mobilephone: '555-0100',
        address1_city: null,
        address1_stateorprovince: 'Virginia',
        address1_postalcode: '22201',
        'mss_District@odata.bind': '/mss_districts(22222222-2222-4222-8222-222222222222)',
      }),
    })
  })

  test('never changes or clears a District that was already stored', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)

    await updateMyProfile(CONTACT_ID, {
      firstName: 'Ava',
      lastName: 'Rahimi',
      email: 'changed@example.org',
      mobilePhone: '',
      city: 'Arlington',
      state: 'Virginia',
      postalCode: '',
      districtId: '33333333-3333-4333-8333-333333333333',
      districtName: 'District 99',
    }, '22222222-2222-4222-8222-222222222222')

    const request = powerPagesFetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(String(request?.body))).toEqual({
      firstname: 'Ava',
      lastname: 'Rahimi',
      mobilephone: null,
      address1_city: 'Arlington',
      address1_stateorprovince: 'Virginia',
      address1_postalcode: null,
    })
  })
})
