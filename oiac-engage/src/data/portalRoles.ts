export type PortalRoleId = 'member' | 'volunteer' | 'staff' | 'applicant'

export type PortalRole = {
  readonly id: PortalRoleId
  readonly name: string
  readonly description: string
  readonly destination: string
  readonly action: string
}

export const portalRoles: readonly PortalRole[] = [
  {
    id: 'member',
    name: 'Member',
    description: 'Review reports, calendar items, and organizational updates.',
    destination: '/my-reports',
    action: 'Open member area',
  },
  {
    id: 'volunteer',
    name: 'Volunteer',
    description: 'Record activity, join events, and keep up with assignments.',
    destination: '/activity/activity-log',
    action: 'Open volunteer area',
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Coordinate appointments, events, and member follow-up.',
    destination: '/activity/appointments',
    action: 'Open staff workspace',
  },
  {
    id: 'applicant',
    name: 'Applicant',
    description: 'Find application guidance and contact the OIAC team.',
    destination: '/contact',
    action: 'Open applicant area',
  },
]
