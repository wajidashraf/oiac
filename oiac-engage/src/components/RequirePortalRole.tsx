import type { PropsWithChildren, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { hasPortalAccess } from '../auth/authorization'
import type { AuthSession } from '../auth/powerPagesSession'
import PendingApproval from '../pages/PendingApproval'
import PendingApprovalShell from './PendingApprovalShell'
import AppShell from './AppShell'

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>

type RequirePortalRoleProps = PropsWithChildren<{
  session: AuthenticatedSession
  calendarElement: ReactNode
  coverageElement?: ReactNode
  appointmentsElement?: ReactNode
  activityElement?: ReactNode
}>

export default function RequirePortalRole({
  session,
  calendarElement,
  coverageElement,
  appointmentsElement,
  activityElement,
  children,
}: RequirePortalRoleProps) {
  const location = useLocation()
  if (hasPortalAccess(session)) return children
  if (activityElement && ['/activity/channel', '/activity/activity-log'].includes(location.pathname)) return (
    <AppShell user={session.user}><Routes>
      <Route path="/activity/channel" element={activityElement} />
      <Route path="/activity/activity-log" element={<Navigate to="/activity/channel" replace />} />
    </Routes></AppShell>
  )

  return (
    <PendingApprovalShell>
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/my-calendar" element={calendarElement} />
        {coverageElement ? <Route path="/press-coverage" element={coverageElement} /> : null}
        {appointmentsElement ? <Route path="/activity/appointments" element={appointmentsElement} /> : null}
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    </PendingApprovalShell>
  )
}
