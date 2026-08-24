import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { appointments, type AppointmentRecord } from '../data/portalData'

type AppointmentsProps = { items?: readonly AppointmentRecord[] }

export default function Appointments({ items = appointments }: AppointmentsProps) {
  useEffect(() => {
    document.title = 'Appointments — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader eyebrow="Activity" title="Appointments" description="Review scheduled conversations and their current status." />
      <ContentCard title="Your appointments" meta={<span>{items.length} records</span>}>
        {items.length === 0 ? (
          <EmptyState headingLevel="h3" title="No appointments yet" description="Scheduled conversations with member services will appear here." />
        ) : <>
        <p className="availability-note">Appointment details will be available after data connection.</p>
        <ul className="record-list">
          {items.map((appointment) => (
            <li key={appointment.id} className="record-list__item">
              <div className="date-tile" aria-hidden="true">
                <span>{appointment.date.split(' ')[1]}</span>
                <strong>{appointment.date.split(' ')[0]}</strong>
              </div>
              <div className="record-list__main">
                <strong>{appointment.title}</strong>
                <span>{appointment.date} · {appointment.time}</span>
                <span>With {appointment.with}</span>
              </div>
              <StatusBadge tone={appointment.status === 'Confirmed' ? 'positive' : appointment.status === 'Pending' ? 'attention' : 'neutral'}>{appointment.status}</StatusBadge>
            </li>
          ))}
        </ul>
        </>}
      </ContentCard>
    </div>
  )
}
