import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { hasRole } from './auth/authorization'
import { readPowerPagesSession, type AuthSession } from './auth/powerPagesSession'
import AnonymousShell from './components/AnonymousShell'
import AppShell from './components/AppShell'
import RegistrationProfileGate from './components/RegistrationProfileGate'
import RequirePortalRole from './components/RequirePortalRole'
import type { ExternalNavigate } from './components/SignInRedirect'
import AnonymousHome from './pages/AnonymousHome'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Home from './pages/Home'
import MyCalendar from './pages/MyCalendar'
import MyReports from './pages/MyReports'
import MeetingReportForm from './pages/MeetingReportForm'
import NotFound from './pages/NotFound'
import Report from './pages/Report'
import Resources from './pages/Resources'
import TrainingResource from './pages/TrainingResource'
import UserProfile from './pages/UserProfile'

type AppProps = {
  session?: AuthSession
  navigate?: ExternalNavigate
}

export default function App({ session: suppliedSession }: AppProps) {
  useLocation()
  const session = suppliedSession ?? readPowerPagesSession()

  if (session.status === 'anonymous') {
    return (
      <AnonymousShell>
        <Routes>
          <Route path="*" element={<AnonymousHome />} />
        </Routes>
      </AnonymousShell>
    )
  }

  return (
    <RegistrationProfileGate
      key={`${session.user.userName}|${session.user.contactId ?? ''}`}
      session={session}
    >
      {(completedSession) => (
        <RequirePortalRole session={completedSession}>
          <AppShell user={completedSession.user}>
            <Routes>
              <Route path="/" element={<Home contactId={completedSession.user.contactId} />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/my-calendar" element={<MyCalendar contactId={completedSession.user.contactId} />} />
              <Route
                path="/contact"
                element={(
                  <Contact
                    user={completedSession.user}
                    isAdmin={hasRole(completedSession, 'Administrators')}
                  />
                )}
              />
              <Route path="/user-profile" element={<UserProfile user={completedSession.user} />} />
              <Route path="/activity" element={<Navigate to="/activity/events" replace />} />
              {/* <Route path="/activity/activity-log" element={<ActivityLog />} /> */}
              <Route
                path="/activity/events"
                element={(
                  <Events
                    isAdmin={hasRole(completedSession, 'Administrators')}
                    contactId={completedSession.user.contactId}
                  />
                )}
              />
              {/* <Route path="/activity/appointments" element={<Appointments />} /> */}
              {/* <Route path="/press-coverage" element={<PressCoverage />} /> */}
              <Route path="/report" element={<Report />} />
              <Route path="/report/new" element={<MeetingReportForm user={completedSession.user} />} />
              <Route path="/report/:reportId/edit" element={<MeetingReportForm user={completedSession.user} />} />
              <Route path="/resources" element={<Resources />} />
              <Route
                path="/resources/volunteer-onboarding-guide"
                element={<TrainingResource title="Volunteer Onboarding Guide" />}
              />
              <Route
                path="/resources/teams-quick-start"
                element={<TrainingResource title="Teams Quick Start" />}
              />
              <Route
                path="/resources/meeting-report-instructions"
                element={<TrainingResource title="Meeting Report Instructions" />}
              />
              <Route path="/pending-approval" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </RequirePortalRole>
      )}
    </RegistrationProfileGate>
  )
}
