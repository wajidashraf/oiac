import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ActivityLog from './pages/ActivityLog'
import Appointments from './pages/Appointments'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Home from './pages/Home'
import MyCalendar from './pages/MyCalendar'
import MyReports from './pages/MyReports'
import NotFound from './pages/NotFound'
import PressCoverage from './pages/PressCoverage'

export default function App() {
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
