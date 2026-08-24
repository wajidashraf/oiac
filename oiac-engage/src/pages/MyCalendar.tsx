import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { agendaItems, type AgendaItem } from '../data/portalData'

type MyCalendarProps = { items?: readonly AgendaItem[] }

export default function MyCalendar({ items = agendaItems }: MyCalendarProps) {
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

        <ContentCard title="Upcoming agenda" meta={<span>{items.length} items</span>}>
          {items.length === 0 ? (
            <EmptyState headingLevel="h3" title="No calendar items yet" description="Events and appointments will appear here when they are scheduled." />
          ) :
          <ol className="timeline-list">
            {items.map((item) => (
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
          }
        </ContentCard>
      </div>
    </div>
  )
}
