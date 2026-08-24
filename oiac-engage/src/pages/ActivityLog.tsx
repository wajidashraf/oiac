import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { activityItems, type ActivityItem } from '../data/portalData'

type ActivityLogProps = { items?: readonly ActivityItem[] }

export default function ActivityLog({ items = activityItems }: ActivityLogProps) {
  const [category, setCategory] = useState('all')
  useEffect(() => {
    document.title = 'Activity Log — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Activity"
        title="Activity Log"
        description="A chronological view of updates associated with your member account."
      />
      <div className="toolbar">
        <label htmlFor="activity-category">Category</label>
        <select id="activity-category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All activity</option>
          <option value="report">Reports</option>
          <option value="event">Events</option>
          <option value="appointment">Appointments</option>
        </select>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Updates to your reports, events, and appointments will appear here." />
      ) : <ol className="activity-feed">
        {items.filter((item) => category === 'all' || item.category.toLowerCase() === category).map((item) => (
          <li key={item.id}>
            <div className="activity-feed__marker" aria-hidden="true" />
            <div className="activity-feed__content">
              <div className="activity-feed__heading">
                <strong>{item.title}</strong>
                <StatusBadge>{item.category}</StatusBadge>
              </div>
              <p>{item.description}</p>
              <time>{item.timestamp}</time>
            </div>
          </li>
        ))}
      </ol>}
    </div>
  )
}
