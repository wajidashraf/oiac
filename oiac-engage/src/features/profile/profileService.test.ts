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

  test('loads the four editable profile fields for the signed-in Contact', async () => {
    const signal = new AbortController().signal
    powerPagesFetchMock.mockResolvedValue({
      contactid: CONTACT_ID,
      firstname: 'Ava',
      lastname: 'Rahimi',
      address1_city: null,
      address1_stateorprovince: 'Virginia',
    })

    await expect(getMyProfile(CONTACT_ID, signal)).resolves.toEqual({
      firstName: 'Ava',
      lastName: 'Rahimi',
      city: '',
      state: 'Virginia',
    })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(
      `/_api/contacts(${CONTACT_ID})?$select=contactid,firstname,lastname,address1_city,address1_stateorprovince`,
      { signal },
    )
  })

  test('rejects an invalid Contact identifier without calling the Web API', async () => {
    await expect(getMyProfile('contact-001')).rejects.toThrow(
      'The Power Pages session did not provide a valid Contact identifier.',
    )
    await expect(updateMyProfile('contact-001', {
      firstName: 'Ava',
      lastName: 'Rahimi',
      city: '',
      state: '',
    })).rejects.toThrow('The Power Pages session did not provide a valid Contact identifier.')
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })

  test('updates only the four editable fields and clears blank optional values', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)

    await expect(updateMyProfile(`{${CONTACT_ID}}`, {
      firstName: '  Ava  ',
      lastName: ' Rahimi ',
      city: '  ',
      state: ' Virginia ',
    })).resolves.toEqual({
      firstName: 'Ava',
      lastName: 'Rahimi',
      city: '',
      state: 'Virginia',
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
        address1_city: null,
        address1_stateorprovince: 'Virginia',
      }),
    })
  })
})
