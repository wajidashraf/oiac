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
      },
    })
  })

  test('treats an empty user name as anonymous', () => {
    expect(readPowerPagesSession({
      Microsoft: { Dynamic365: { Portal: { User: { userName: '   ' } } } },
    })).toEqual({ status: 'anonymous' })
  })
})
