import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { appointments } from '../data/portalData'

export default function Appointments() {
  useEffect(() => {
    document.title = 'Appointments — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader eyebrow="Activity" title="Appointments" description="Review scheduled conversations and their current status." />
      <ContentCard title="Your appointments" meta={<span>{appointments.length} records</span>}>
        <ul className="record-list">
          {appointments.map((appointment) => (
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
              <button type="button" className="button button--quiet" aria-label={`View ${appointment.title}`}>View</button>
            </li>
          ))}
        </ul>
      </ContentCard>
    </div>
  )
}
