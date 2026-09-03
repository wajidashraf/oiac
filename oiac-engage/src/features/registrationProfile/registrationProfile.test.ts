import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { AuthSession } from '../../auth/powerPagesSession'
import { powerPagesFetch } from '../../shared/powerPagesApi'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
}))

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>
type RegistrationProfileModule = {
  readonly REGISTRATION_PROFILE_STORAGE_KEY: string
  readonly finalizeRegistrationProfile: (
    session: AuthenticatedSession,
    storage?: Storage,
  ) => Promise<AuthenticatedSession>
}

const featureModules = import.meta.glob('./registrationProfile.ts', { eager: true }) as Record<
  string,
  RegistrationProfileModule
>
const featurePath = './registrationProfile.ts'
const powerPagesFetchMock = vi.mocked(powerPagesFetch)
const CONTACT_ID = '11111111-1111-4111-8111-111111111111'
const session: AuthenticatedSession = {
  status: 'authenticated',
  user: {
    userName: 'ada@example.org',
    contactId: `{${CONTACT_ID.toUpperCase()}}`,
    userRoles: ['Authenticated Users'],
  },
}

function feature(): RegistrationProfileModule {
  const registrationProfile = featureModules[featurePath]
  expect(registrationProfile, 'registrationProfile.ts must exist').toBeDefined()
  return registrationProfile
}

function storePending(overrides: Record<string, unknown> = {}): string {
  const key = feature().REGISTRATION_PROFILE_STORAGE_KEY
  sessionStorage.setItem(key, JSON.stringify({
    version: 1,
    firstName: ' Ada ',
    lastName: ' Lovelace ',
    email: 'ADA@example.org',
    username: 'ada.lovelace',
    createdAt: Date.now(),
    ...overrides,
  }))
  return key
}

beforeEach(() => {
  sessionStorage.clear()
  powerPagesFetchMock.mockReset()
})

describe('registration profile finalization', () => {
  test('patches only the authenticated Contact names and clears the pending payload', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)
    const key = storePending()

    await expect(feature().finalizeRegistrationProfile(session)).resolves.toEqual({
      status: 'authenticated',
      user: {
        ...session.user,
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    })
    expect(powerPagesFetchMock).toHaveBeenCalledWith(`/_api/contacts(${CONTACT_ID})`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '*',
      },
      body: JSON.stringify({ firstname: 'Ada', lastname: 'Lovelace' }),
    })
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  test('accepts the native Username identifier when it differs from email', async () => {
    powerPagesFetchMock.mockResolvedValue(undefined)
    const key = storePending()
    const usernameSession: AuthenticatedSession = {
      ...session,
      user: { ...session.user, userName: 'ADA.LOVELACE' },
    }

    await feature().finalizeRegistrationProfile(usernameSession)

    expect(powerPagesFetchMock).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  test.each([
    ['malformed', '{bad-json'],
    ['too-long', JSON.stringify({
      version: 1,
      firstName: 'A'.repeat(51),
      lastName: 'Lovelace',
      email: 'ada@example.org',
      username: 'ada.lovelace',
      createdAt: Date.now(),
    })],
    ['expired', JSON.stringify({
      version: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
      username: 'ada.lovelace',
      createdAt: Date.now() - (31 * 60 * 1000),
    })],
  ])('discards a %s payload without updating a Contact', async (_kind, rawPayload) => {
    const key = feature().REGISTRATION_PROFILE_STORAGE_KEY
    sessionStorage.setItem(key, rawPayload)

    await expect(feature().finalizeRegistrationProfile(session)).resolves.toEqual(session)
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  test('discards an identity-mismatched payload without updating a Contact', async () => {
    const key = storePending({
      email: 'someone-else@example.org',
      username: 'someone.else',
    })

    await expect(feature().finalizeRegistrationProfile(session)).resolves.toEqual(session)
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  test('retains the payload when the authenticated Contact identifier is invalid', async () => {
    const key = storePending()
    const invalidContactSession: AuthenticatedSession = {
      ...session,
      user: { ...session.user, contactId: 'not-a-contact-id' },
    }

    await expect(feature().finalizeRegistrationProfile(invalidContactSession)).rejects.toThrow(
      'The Power Pages session did not provide a valid Contact identifier.',
    )
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).not.toBeNull()
  })

  test('retains the payload when the Contact update fails so it can be retried', async () => {
    const key = storePending()
    powerPagesFetchMock.mockRejectedValue(new Error('Dataverse unavailable'))

    await expect(feature().finalizeRegistrationProfile(session)).rejects.toThrow('Dataverse unavailable')
    expect(sessionStorage.getItem(key)).not.toBeNull()
  })

  test('continues safely when the browser blocks session storage access', async () => {
    const inaccessibleStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('Storage access denied', 'SecurityError')
      }),
      removeItem: vi.fn(),
    } as unknown as Storage

    await expect(feature().finalizeRegistrationProfile(session, inaccessibleStorage)).resolves.toEqual(session)
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })
})
