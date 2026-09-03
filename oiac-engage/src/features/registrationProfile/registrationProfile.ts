import type { AuthSession } from '../../auth/powerPagesSession'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import { normalizeProfileContactId } from '../profile/profileService'

export const REGISTRATION_PROFILE_STORAGE_KEY = 'oiac.registrationProfile.pending.v1'

const PAYLOAD_VERSION = 1
const MAX_AGE_MS = 30 * 60 * 1000
const MAX_NAME_LENGTH = 50
const INVALID_CONTACT_MESSAGE = 'The Power Pages session did not provide a valid Contact identifier.'

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>

export type PendingRegistrationProfile = {
  readonly version: 1
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly username: string
  readonly createdAt: number
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function removePendingProfile(storage: Storage): void {
  try {
    storage.removeItem(REGISTRATION_PROFILE_STORAGE_KEY)
  } catch {
    // A completed Contact update should not become a portal-blocking error if storage is restricted.
  }
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

function parsePendingProfile(raw: string, now: number): PendingRegistrationProfile | null {
  let candidate: unknown

  try {
    candidate = JSON.parse(raw)
  } catch {
    return null
  }

  if (!candidate || typeof candidate !== 'object') return null

  const value = candidate as Record<string, unknown>
  const firstName = typeof value.firstName === 'string' ? value.firstName.trim() : ''
  const lastName = typeof value.lastName === 'string' ? value.lastName.trim() : ''
  const email = typeof value.email === 'string' ? value.email.trim() : ''
  const username = typeof value.username === 'string' ? value.username.trim() : ''
  const createdAt = value.createdAt

  if (
    value.version !== PAYLOAD_VERSION ||
    !firstName ||
    !lastName ||
    firstName.length > MAX_NAME_LENGTH ||
    lastName.length > MAX_NAME_LENGTH ||
    (!email && !username) ||
    typeof createdAt !== 'number' ||
    !Number.isFinite(createdAt) ||
    createdAt > now ||
    now - createdAt > MAX_AGE_MS
  ) {
    return null
  }

  return {
    version: PAYLOAD_VERSION,
    firstName,
    lastName,
    email,
    username,
    createdAt,
  }
}

export function readPendingRegistrationProfile(
  suppliedStorage?: Storage | null,
  now = Date.now(),
): PendingRegistrationProfile | null {
  const storage = resolveStorage(suppliedStorage)
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(REGISTRATION_PROFILE_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  const pending = parsePendingProfile(raw, now)
  if (!pending) removePendingProfile(storage)
  return pending
}

function identityMatches(userName: string, pending: PendingRegistrationProfile): boolean {
  const authenticatedIdentifier = normalizeIdentifier(userName)
  return [pending.email, pending.username]
    .map(normalizeIdentifier)
    .filter(Boolean)
    .includes(authenticatedIdentifier)
}

export async function finalizeRegistrationProfile(
  session: AuthenticatedSession,
  suppliedStorage?: Storage | null,
): Promise<AuthenticatedSession> {
  const storage = resolveStorage(suppliedStorage)
  if (!storage) return session

  const pending = readPendingRegistrationProfile(storage)
  if (!pending) return session

  if (!identityMatches(session.user.userName, pending)) {
    removePendingProfile(storage)
    return session
  }

  const contactId = normalizeProfileContactId(session.user.contactId)
  if (!contactId) throw new Error(INVALID_CONTACT_MESSAGE)

  await powerPagesFetch<void>(`/_api/contacts(${contactId})`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': '*',
    },
    body: JSON.stringify({
      firstname: pending.firstName,
      lastname: pending.lastName,
    }),
  })

  removePendingProfile(storage)
  return {
    status: 'authenticated',
    user: {
      ...session.user,
      firstName: pending.firstName,
      lastName: pending.lastName,
    },
  }
}
