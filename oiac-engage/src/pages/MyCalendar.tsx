import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { agendaItems } from '../data/portalData'

export default function MyCalendar() {
  useEffect(() => {
    document.title = 'My Calendar — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your schedule"
        title="My Calendar"
        description="Keep track of upcoming member events and appointments."
      />

      <div className="calendar-layout">
        <aside className="date-card" aria-label="Current date">
          <span className="date-card__month">August</span>
          <strong>24</strong>
          <span>Monday · 2026</span>
        </aside>

        <ContentCard title="Upcoming agenda" meta={<span>{agendaItems.length} items</span>}>
          <ol className="timeline-list">
            {agendaItems.map((item) => (
              <li key={item.id}>
                <div className="timeline-list__date">
                  <time>{item.date}</time>
                  <span>{item.time}</span>
                </div>
                <div className="timeline-list__content">
                  <strong>{item.title}</strong>
                  <StatusBadge tone={item.type === 'Appointment' ? 'attention' : 'neutral'}>{item.type}</StatusBadge>
                </div>
              </li>
            ))}
          </ol>
        </ContentCard>
      </div>
    </div>
  )
}
