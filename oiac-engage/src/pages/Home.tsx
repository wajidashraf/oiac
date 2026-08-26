import { useEffect, type PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import ContentCard from '../components/ContentCard'
import StatusBadge from '../components/StatusBadge'
import {
  dashboardAnnouncements,
  dashboardEvents,
  dashboardMetrics,
  meetingInvites,
  meetingReports,
  teamResourceGroups,
  trainingResources,
  volunteerSubmissions,
} from '../data/dashboardData'

const dashboardShortcuts = [
  { label: 'Activity', href: '/activity/activity-log' },
  { label: 'Events', href: '/activity/events' },
  { label: 'Appointments', href: '/activity/appointments' },
  { label: 'Resources', href: '/resources' },
] as const

function HandshakeIcon() {
  return (
    <span className="dashboard-identity__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M8.7 8.8 11 6.5a3 3 0 0 1 4.2 0l1.2 1.2" />
        <path d="m3.2 6.7 3.3-3.3 3.2 3.2-3.3 3.3zM14.3 6.6l3.2-3.2 3.3 3.3-3.2 3.2z" />
        <path d="m6.6 9.8 6.4 6.4a1.4 1.4 0 0 1-2 2l-1-1" />
        <path d="m8.2 15.4 1.8 1.8a1.4 1.4 0 0 1-2 2l-4.2-4.1a3.1 3.1 0 0 1 0-4.4l2.1-2.1" />
        <path d="m17.6 9.8 2.6 2.6a1.4 1.4 0 0 1-2 2l-3.4-3.4" />
        <path d="m14.8 11 3.4 3.4a1.4 1.4 0 0 1-2 2l-3.4-3.4" />
      </svg>
    </span>
  )
}

function DashboardTable({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div
      className="dashboard-table-scroll"
      role="region"
      aria-label={`${label} table, scroll horizontally`}
      tabIndex={0}
    >
      <table className="dashboard-table" aria-label={label}>{children}</table>
    </div>
  )
}

function invitationTone(status: 'Pending' | 'Accepted') {
  return status === 'Accepted' ? 'positive' : 'attention'
}

function submissionTone(status: 'Submitted' | 'Confirmed' | 'Completed') {
  if (status === 'Confirmed') return 'positive'
  if (status === 'Submitted') return 'attention'
  return 'neutral'
}

export default function Home() {
  useEffect(() => {
    document.title = 'Volunteer Dashboard — OIAC Engage'
  }, [])

  return (
    <div className="page page--dashboard">
      <header className="dashboard-identity">
        <div className="dashboard-identity__profile">
          <HandshakeIcon />
          <div>
            <p className="dashboard-identity__eyebrow">Dashboard</p>
            <h1>Volunteer</h1>
          </div>
        </div>
        <nav className="dashboard-shortcuts" aria-label="Dashboard shortcuts">
          {dashboardShortcuts.map((shortcut) => (
            <Link key={shortcut.href} to={shortcut.href}>{shortcut.label}</Link>
          ))}
        </nav>
      </header>

      <section className="dashboard-metrics" role="group" aria-label="Volunteer summary">
        {dashboardMetrics.map((metric) => (
          <article className="dashboard-metric" key={metric.id}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-section" aria-labelledby="meeting-reports-title">
        <div className="dashboard-section__heading">
          <h2 id="meeting-reports-title">Meeting Reports</h2>
          <Link className="button button--primary dashboard-submit-report" to="/report">+ Submit Report</Link>
        </div>
        <DashboardTable label="Meeting Reports">
          <thead>
            <tr>
              <th scope="col">Meeting</th>
              <th scope="col">Representative</th>
              <th scope="col">Date</th>
              <th scope="col">Outcome</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {meetingReports.map((report) => (
              <tr key={report.id}>
                <th scope="row">{report.meeting}</th>
                <td>{report.representative}</td>
                <td><time>{report.date}</time></td>
                <td>{report.outcome}</td>
                <td><Link aria-label={`Edit ${report.meeting}`} to="/report">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </DashboardTable>
      </section>

      <section className="dashboard-operational-grid" aria-label="Volunteer schedule and updates">
        <ContentCard title="Upcoming Events" headingLevel="h2" className="dashboard-panel">
          <ul className="dashboard-event-list">
            {dashboardEvents.map((event) => (
              <li key={event.id}>
                <span className="dashboard-date-tile" aria-hidden="true">
                  <strong>{event.day}</strong>
                  <span>{event.month}</span>
                </span>
                <span>{event.title}</span>
              </li>
            ))}
          </ul>
          <Link className="dashboard-panel__footer-link" to="/my-calendar">See all → My Calendar</Link>
        </ContentCard>

        <ContentCard title="Meeting Invites" headingLevel="h2" className="dashboard-panel">
          <ul className="dashboard-invite-list">
            {meetingInvites.map((invite) => (
              <li key={invite.id}>
                <div>
                  <strong>{invite.title}</strong>
                  <span>{invite.schedule}</span>
                </div>
                <StatusBadge tone={invitationTone(invite.status)}>{invite.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </ContentCard>

        <div className="dashboard-panel-stack">
          <ContentCard title="Teams Announcements" headingLevel="h2" className="dashboard-panel">
            <ul className="dashboard-announcement-list">
              {dashboardAnnouncements.map((announcement) => (
                <li key={announcement.id}>
                  <span className="dashboard-announcement-list__marker" aria-hidden="true" />
                  <div>
                    <strong>{announcement.title}</strong>
                    <span>{announcement.timestamp}</span>
                  </div>
                </li>
              ))}
            </ul>
          </ContentCard>

          <ContentCard title="Training Resources" headingLevel="h2" className="dashboard-panel">
            <ul className="dashboard-training-list">
              {trainingResources.map((resource) => (
                <li key={resource.id}>
                  <span className="dashboard-training-list__marker" aria-hidden="true" />
                  <Link to={resource.href}>{resource.title}</Link>
                </li>
              ))}
            </ul>
          </ContentCard>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="teams-resources-title">
        <div className="dashboard-section__heading">
          <h2 id="teams-resources-title">Teams &amp; Resources</h2>
          <span className="dashboard-admin-label">Managed by Admin</span>
        </div>
        <div className="dashboard-resource-grid">
          {teamResourceGroups.map((group) => (
            <ContentCard
              key={group.id}
              title={group.title}
              headingLevel="h3"
              className="dashboard-panel dashboard-team-card"
              meta={<span className="dashboard-team-card__marker" aria-hidden="true">{group.marker}</span>}
            >
              <ul className="dashboard-team-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <Link to={item.href} aria-label={`${item.action} ${item.title}`}>
                      {item.action} <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ContentCard>
          ))}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="volunteer-submissions-title">
        <div className="dashboard-section__heading">
          <h2 id="volunteer-submissions-title">Volunteer Submissions</h2>
        </div>
        <DashboardTable label="Volunteer Submissions">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Subject</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {volunteerSubmissions.map((submission) => (
              <tr key={submission.id}>
                <td><span className="dashboard-type-label">{submission.type}</span></td>
                <th scope="row">{submission.subject}</th>
                <td><time>{submission.date}</time></td>
                <td><StatusBadge tone={submissionTone(submission.status)}>{submission.status}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </DashboardTable>
      </section>
    </div>
  )
}
