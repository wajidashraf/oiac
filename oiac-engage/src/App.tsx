import { Navigate, Route, Routes } from 'react-router-dom'
import { hasRole } from './auth/authorization'
import { readPowerPagesSession, type AuthSession } from './auth/powerPagesSession'
import AnonymousShell from './components/AnonymousShell'
import AppShell from './components/AppShell'
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

type AppProps = {
  session?: AuthSession
  navigate?: ExternalNavigate
}

export default function App({ session: suppliedSession }: AppProps) {
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
    <AppShell user={session.user}>
      <Routes>
        <Route path="/" element={<Home contactId={session.user.contactId} />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/my-calendar" element={<MyCalendar contactId={session.user.contactId} />} />
        <Route path="/contact" element={<Contact user={session.user} />} />
        <Route path="/activity" element={<Navigate to="/activity/events" replace />} />
        {/* <Route path="/activity/activity-log" element={<ActivityLog />} /> */}
        <Route
          path="/activity/events"
          element={<Events isAdmin={hasRole(session, 'Administrators')} contactId={session.user.contactId} />}
        />
        {/* <Route path="/activity/appointments" element={<Appointments />} /> */}
        {/* <Route path="/press-coverage" element={<PressCoverage />} /> */}
        <Route path="/report" element={<Report />} />
        <Route path="/report/new" element={<MeetingReportForm user={session.user} />} />
        <Route path="/report/:reportId/edit" element={<MeetingReportForm user={session.user} />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
