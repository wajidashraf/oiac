import { describe, expect, test } from 'vitest'
import type { AuthSession } from './powerPagesSession'
import {
  getPrimaryRole,
  hasAllRoles,
  hasAnyRole,
  hasRole,
  requiresProfileApproval,
} from './authorization'

const session: AuthSession = {
  status: 'authenticated',
  user: {
    userName: 'volunteer@oiac.org',
    userRoles: ['Authenticated Users', 'Volunteer'],
  },
}

describe('Power Pages web-role authorization', () => {
  test('matches role names case-insensitively', () => {
    expect(hasRole(session, 'volunteer')).toBe(true)
    expect(hasRole(session, 'Staff')).toBe(false)
  })

  test('supports any-role and all-role permission checks', () => {
    expect(hasAnyRole(session, ['Staff', 'Volunteer'])).toBe(true)
    expect(hasAllRoles(session, ['authenticated users', 'VOLUNTEER'])).toBe(true)
    expect(hasAllRoles(session, ['Authenticated Users', 'Staff'])).toBe(false)
  })

  test('never grants a role to an anonymous session', () => {
    expect(hasRole({ status: 'anonymous' }, 'Anonymous Users')).toBe(false)
  })

  test('uses the assigned functional web role for the account label', () => {
    expect(getPrimaryRole(session)).toBe('Volunteer')
    expect(getPrimaryRole({
      status: 'authenticated',
      user: { userName: 'staff@oiac.org', userRoles: ['Authenticated Users', 'Staff'] },
    })).toBe('Staff')
    expect(getPrimaryRole({
      status: 'authenticated',
      user: {
        userName: 'multi-role@oiac.org',
        userRoles: ['Authenticated Users', 'Volunteer', 'Staff'],
      },
    })).toBe('Staff')
    expect(getPrimaryRole({ status: 'anonymous' })).toBeUndefined()
  })
})

describe('profile approval role gate', () => {
  test.each([
    [[], true],
    [['Authenticated Users'], true],
    [[' anonymous users ', 'AUTHENTICATED USERS'], true],
    [['Authenticated Users', 'Volunteer'], false],
    [['Authenticated Users', 'Regional Coordinator'], false],
  ])('evaluates authenticated roles %j', (userRoles, expected) => {
    expect(requiresProfileApproval({
      status: 'authenticated',
      user: { userName: 'member@oiac.org', userRoles },
    })).toBe(expected)
  })

  test('does not treat anonymous visitors as pending profiles', () => {
    expect(requiresProfileApproval({ status: 'anonymous' })).toBe(false)
  })
})
