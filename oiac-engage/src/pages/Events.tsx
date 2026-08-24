import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { events } from '../data/portalData'

export default function Events() {
  useEffect(() => {
    document.title = 'Events — OIAC Engage'
  }, [])

  const upcoming = events.filter((event) => event.status !== 'Attended')
  const past = events.filter((event) => event.status === 'Attended')

  return (
    <div className="page">
      <PageHeader eyebrow="Activity" title="Events" description="Browse events connected to your membership and registration status." />
      <section aria-labelledby="upcoming-events-title">
        <h2 id="upcoming-events-title" className="section-title">Upcoming events</h2>
        <div className="card-grid">
          {upcoming.map((event) => (
            <ContentCard key={event.id} title={event.title} meta={<StatusBadge tone={event.status === 'Registered' ? 'positive' : 'neutral'}>{event.status}</StatusBadge>}>
              <p>{event.description}</p>
              <dl className="detail-list">
                <div><dt>Date</dt><dd>{event.date}</dd></div>
                <div><dt>Time</dt><dd>{event.time}</dd></div>
                <div><dt>Location</dt><dd>{event.location}</dd></div>
              </dl>
            </ContentCard>
          ))}
        </div>
      </section>
      <section aria-labelledby="past-events-title">
        <h2 id="past-events-title" className="section-title">Past events</h2>
        <ul className="simple-list">
          {past.map((event) => <li key={event.id}><strong>{event.title}</strong><span>{event.date} · {event.location}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
