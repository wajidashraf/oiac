export type PortalUser = {
  readonly userName: string
  readonly firstName?: string
  readonly lastName?: string
  readonly contactId?: string
  readonly userRoles: readonly string[]
}

export type AuthSession =
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly user: PortalUser }

export const ANONYMOUS_SESSION: AuthSession = { status: 'anonymous' }

type PowerPagesWindow = {
  Microsoft?: {
    Dynamic365?: {
      Portal?: {
        User?: Partial<PortalUser>
      }
    }
  }
}

export function readPowerPagesSession(source: unknown = window): AuthSession {
  const user = (source as PowerPagesWindow)?.Microsoft?.Dynamic365?.Portal?.User
  const userName = user?.userName?.trim()

  if (!user || !userName) return ANONYMOUS_SESSION

  return {
    status: 'authenticated',
    user: {
      userName,
      firstName: user.firstName,
      lastName: user.lastName,
      contactId: user.contactId,
      userRoles: Array.isArray(user.userRoles)
        ? user.userRoles
          .filter((role): role is string => typeof role === 'string')
          .map((role) => role.trim())
          .filter((role) => role.length > 0)
        : [],
    },
  }
}
