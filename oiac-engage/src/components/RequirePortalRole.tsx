import type { PropsWithChildren, ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { hasPortalAccess } from '../auth/authorization'
import type { AuthSession } from '../auth/powerPagesSession'
import PendingApproval from '../pages/PendingApproval'
import PendingApprovalShell from './PendingApprovalShell'

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>

type RequirePortalRoleProps = PropsWithChildren<{
  session: AuthenticatedSession
  calendarElement: ReactNode
}>

export default function RequirePortalRole({
  session,
  calendarElement,
  children,
}: RequirePortalRoleProps) {
  if (hasPortalAccess(session)) return children

  return (
    <PendingApprovalShell>
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/my-calendar" element={calendarElement} />
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    </PendingApprovalShell>
  )
}
