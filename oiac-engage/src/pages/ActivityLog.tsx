import { useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { activityItems } from '../data/portalData'

export default function ActivityLog() {
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
        <select id="activity-category" defaultValue="all">
          <option value="all">All activity</option>
          <option value="report">Reports</option>
          <option value="event">Events</option>
          <option value="appointment">Appointments</option>
        </select>
      </div>
      <ol className="activity-feed">
        {activityItems.map((item) => (
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
      </ol>
    </div>
  )
}
