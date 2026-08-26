import { Navigate, Route, Routes } from 'react-router-dom'
import { readPowerPagesSession, type AuthSession } from './auth/powerPagesSession'
import AnonymousShell from './components/AnonymousShell'
import AppShell from './components/AppShell'
import SignInRedirect, { type ExternalNavigate } from './components/SignInRedirect'
import ActivityLog from './pages/ActivityLog'
import AnonymousHome from './pages/AnonymousHome'
import Appointments from './pages/Appointments'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Home from './pages/Home'
import MyCalendar from './pages/MyCalendar'
import MyReports from './pages/MyReports'
import NotFound from './pages/NotFound'
import PressCoverage from './pages/PressCoverage'

type AppProps = {
  session?: AuthSession
  navigate?: ExternalNavigate
}

const browserNavigate: ExternalNavigate = (href) => window.location.assign(href)

export default function App({
  session = readPowerPagesSession(),
  navigate = browserNavigate,
}: AppProps) {
  if (session.status === 'anonymous') {
    return (
      <AnonymousShell>
        <Routes>
          <Route path="/" element={<AnonymousHome />} />
          <Route path="*" element={<SignInRedirect navigate={navigate} />} />
        </Routes>
      </AnonymousShell>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/my-calendar" element={<MyCalendar />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/activity" element={<Navigate to="/activity/activity-log" replace />} />
        <Route path="/activity/activity-log" element={<ActivityLog />} />
        <Route path="/activity/events" element={<Events />} />
        <Route path="/activity/appointments" element={<Appointments />} />
        <Route path="/press-coverage" element={<PressCoverage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
