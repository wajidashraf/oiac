import { describe, expect, test } from 'vitest'
import { portalRoles } from './portalRoles'

describe('portal role entry points', () => {
  test('keeps the existing member audience and adds the three requested roles', () => {
    expect(portalRoles.map((role) => role.name)).toEqual([
      'Member',
      'Volunteer',
      'Staff',
      'Applicant',
    ])
  })

  test('gives every role a unique identifier and an internal destination', () => {
    expect(new Set(portalRoles.map((role) => role.id)).size).toBe(portalRoles.length)
    expect(portalRoles.map(({ id, destination }) => [id, destination])).toEqual([
      ['member', '/my-reports'],
      ['volunteer', '/activity/activity-log'],
      ['staff', '/activity/appointments'],
      ['applicant', '/contact'],
    ])
  })
})
