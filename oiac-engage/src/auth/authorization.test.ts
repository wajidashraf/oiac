import { describe, expect, test } from 'vitest'
import type { AuthSession } from './powerPagesSession'
import {
  getPrimaryRole,
  hasAllRoles,
  hasAnyRole,
  hasPortalAccess,
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

describe('portal access role gate', () => {
  test.each(['Administrators', 'Staff', 'Volunteer', 'Applicant'])(
    'allows the %s role',
    (role) => {
      const approvedSession: AuthSession = {
        status: 'authenticated',
        user: { userName: 'member@oiac.org', userRoles: ['Authenticated Users', role] },
      }

      expect(hasPortalAccess(approvedSession)).toBe(true)
      expect(requiresProfileApproval(approvedSession)).toBe(false)
    },
  )

  test('matches approved roles case-insensitively after trimming whitespace', () => {
    const approvedSession: AuthSession = {
      status: 'authenticated',
      user: { userName: 'member@oiac.org', userRoles: [' authenticated users ', ' volunteer '] },
    }

    expect(hasPortalAccess(approvedSession)).toBe(true)
    expect(requiresProfileApproval(approvedSession)).toBe(false)
  })

  test.each([
    [[]],
    [['Authenticated Users']],
    [['Anonymous Users', 'Authenticated Users']],
    [['Authenticated Users', 'Regional Coordinator']],
  ])('denies authenticated roles %j', (userRoles) => {
    const deniedSession: AuthSession = {
      status: 'authenticated',
      user: { userName: 'pending@oiac.org', userRoles },
    }

    expect(hasPortalAccess(deniedSession)).toBe(false)
    expect(requiresProfileApproval(deniedSession)).toBe(true)
  })

  test('allows a mixed role list when one role is approved', () => {
    const approvedSession: AuthSession = {
      status: 'authenticated',
      user: {
        userName: 'member@oiac.org',
        userRoles: ['Authenticated Users', 'Regional Coordinator', 'Staff'],
      },
    }

    expect(hasPortalAccess(approvedSession)).toBe(true)
    expect(requiresProfileApproval(approvedSession)).toBe(false)
  })

  test('does not grant portal access or pending status to an anonymous session', () => {
    const anonymousSession: AuthSession = { status: 'anonymous' }

    expect(hasPortalAccess(anonymousSession)).toBe(false)
    expect(requiresProfileApproval(anonymousSession)).toBe(false)
  })
})
