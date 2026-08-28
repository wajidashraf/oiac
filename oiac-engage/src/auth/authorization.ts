import type { AuthSession } from './powerPagesSession'

// Client-side role checks control the UI only. Power Pages table permissions
// and web roles must enforce access to Dataverse data on the server.
export function getUserRoles(session: AuthSession): readonly string[] {
  return session.status === 'authenticated' ? session.user.userRoles : []
}

export function hasRole(session: AuthSession, roleName: string): boolean {
  const expectedRole = roleName.trim().toLowerCase()
  return expectedRole.length > 0 && getUserRoles(session).some(
    (role) => role.trim().toLowerCase() === expectedRole,
  )
}

export function hasAnyRole(session: AuthSession, roleNames: readonly string[]): boolean {
  return roleNames.some((roleName) => hasRole(session, roleName))
}

export function hasAllRoles(session: AuthSession, roleNames: readonly string[]): boolean {
  return roleNames.every((roleName) => hasRole(session, roleName))
}

const implicitRoles = new Set(['authenticated users', 'anonymous users'])
const functionalRolePriority = ['Administrators', 'Staff', 'Volunteer', 'Applicant'] as const

export function getPrimaryRole(session: AuthSession): string | undefined {
  if (session.status === 'anonymous') return undefined

  const normalizedRoles = new Set(session.user.userRoles.map((role) => role.trim().toLowerCase()))
  const prioritizedRole = functionalRolePriority.find(
    (role) => normalizedRoles.has(role.toLowerCase()),
  )

  return prioritizedRole ?? session.user.userRoles.find(
    (role) => !implicitRoles.has(role.trim().toLowerCase()),
  )?.trim() ?? 'Authenticated User'
}
