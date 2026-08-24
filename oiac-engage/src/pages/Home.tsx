import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { activityItems, agendaItems, reports } from '../data/portalData'
import { portalRoles } from '../data/portalRoles'

export default function Home() {
  useEffect(() => {
    document.title = 'OIAC Engage'
  }, [])

  return (
    <div className="page page--home">
      <section className="home-intro">
        <PageHeader
          eyebrow="Member portal"
          title="Welcome to OIAC Engage"
          description="Your reports, schedule, activity, and member updates in one place."
        />
        <div className="quick-links" role="group" aria-label="Portal shortcuts">
          <Link className="quick-link" to="/my-reports">
            <span className="quick-link__label">View my reports</span>
            <span>{reports.length} reports</span>
          </Link>
          <Link className="quick-link" to="/my-calendar">
            <span className="quick-link__label">Open my calendar</span>
            <span>{agendaItems.length} upcoming items</span>
          </Link>
          <Link className="quick-link" to="/activity/activity-log">
            <span className="quick-link__label">Review activity</span>
            <span>{activityItems.length} recent updates</span>
          </Link>
        </div>
      </section>

      <section className="role-directory" aria-labelledby="role-directory-title">
        <div className="role-directory__heading">
          <div>
            <p className="section-kicker">Role-based access</p>
            <h2 id="role-directory-title">Ways to participate</h2>
          </div>
          <p>Choose the area that matches how you work with OIAC.</p>
        </div>
        <div className="role-grid">
          {portalRoles.map((role) => (
            <Link className={`role-card role-card--${role.id}`} key={role.id} to={role.destination}>
              <span className="role-card__marker" aria-hidden="true">{role.name.charAt(0)}</span>
              <span className="role-card__content">
                <strong>{role.name}</strong>
                <span>{role.description}</span>
                <span className="role-card__action">{role.action} <span aria-hidden="true">→</span></span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Member overview">
        <ContentCard title="Recent activity" meta={<Link to="/activity/activity-log">View all</Link>}>
          <ul className="stack-list">
            {activityItems.slice(0, 2).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                <StatusBadge>{item.category}</StatusBadge>
              </li>
            ))}
          </ul>
        </ContentCard>

        <ContentCard title="Next on your calendar" meta={<Link to="/my-calendar">Full calendar</Link>}>
          <ul className="stack-list">
            {agendaItems.slice(0, 2).map((item) => (
              <li key={item.id}>
                <time>{item.date}</time>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </ContentCard>
      </section>
    </div>
  )
}
