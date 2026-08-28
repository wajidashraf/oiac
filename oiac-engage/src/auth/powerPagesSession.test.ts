import { describe, expect, test } from 'vitest'
import { readPowerPagesSession } from './powerPagesSession'

describe('readPowerPagesSession', () => {
  test('returns anonymous when the Power Pages global is missing', () => {
    expect(readPowerPagesSession({})).toEqual({ status: 'anonymous' })
  })

  test('returns the authenticated Power Pages user', () => {
    const source = {
      Microsoft: {
        Dynamic365: {
          Portal: {
            User: {
              userName: 'member@oiac.org',
              firstName: 'OIAC',
              lastName: 'Member',
              contactId: 'contact-001',
              userRoles: ['Authenticated Users', 'Volunteer'],
            },
          },
        },
      },
    }

    expect(readPowerPagesSession(source)).toEqual({
      status: 'authenticated',
      user: {
        userName: 'member@oiac.org',
        firstName: 'OIAC',
        lastName: 'Member',
        contactId: 'contact-001',
        userRoles: ['Authenticated Users', 'Volunteer'],
      },
    })
  })

  test('normalizes missing Power Pages web roles to an empty list', () => {
    expect(readPowerPagesSession({
      Microsoft: { Dynamic365: { Portal: { User: { userName: 'member@oiac.org' } } } },
    })).toEqual({
      status: 'authenticated',
      user: {
        userName: 'member@oiac.org',
        firstName: undefined,
        lastName: undefined,
        contactId: undefined,
        userRoles: [],
      },
    })
  })

  test('trims role names and removes invalid role values', () => {
    const source = {
      Microsoft: {
        Dynamic365: {
          Portal: {
            User: {
              userName: 'staff@oiac.org',
              userRoles: [' Authenticated Users ', '', ' Staff ', 42],
            },
          },
        },
      },
    }

    expect(readPowerPagesSession(source)).toMatchObject({
      status: 'authenticated',
      user: { userRoles: ['Authenticated Users', 'Staff'] },
    })
  })

  test('treats an empty user name as anonymous', () => {
    expect(readPowerPagesSession({
      Microsoft: { Dynamic365: { Portal: { User: { userName: '   ' } } } },
    })).toEqual({ status: 'anonymous' })
  })
})
