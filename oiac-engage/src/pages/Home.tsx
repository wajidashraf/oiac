import { useEffect, type PropsWithChildren } from 'react'
import {
  LuArrowRight,
  LuBookOpen,
  LuCalendarDays,
  LuClipboardList,
  LuFileText,
  LuGraduationCap,
  LuHandshake,
  LuHash,
} from 'react-icons/lu'
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

const teamResourceIcons = {
  'upcoming-meetings': LuCalendarDays,
  'important-channels': LuHash,
  'recent-documents': LuFileText,
} as const

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
          <span className="dashboard-identity__icon" aria-hidden="true">
            <LuHandshake />
          </span>
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
          <Link className="button button--primary dashboard-submit-report" to="/report/new">+ Submit Report</Link>
        </div>
        <DashboardTable label="Meeting Reports">
          <thead>
            <tr>
              <th scope="col">Meeting</th>
              <th scope="col">Representative</th>
              <th scope="col">Date</th>
              <th scope="col">Outcome</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {meetingReports.map((report) => (
              <tr key={report.id}>
                <th scope="row">{report.meeting}</th>
                <td>{report.representative}</td>
                <td><time dateTime={report.dateTime}>{report.date}</time></td>
                <td>{report.outcome}</td>
                <td><Link aria-label={`Edit ${report.meeting}`} to={`/report/${report.id}/edit`}>Edit</Link></td>
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
                <time className="dashboard-date-tile" dateTime={event.dateTime}>
                  <strong>{event.day}</strong>
                  <span>{event.month}</span>
                </time>
                <span>{event.title}</span>
              </li>
            ))}
          </ul>
          <Link className="dashboard-panel__footer-link" to="/my-calendar">
            <span>See all</span><LuArrowRight aria-hidden="true" /><span>My Calendar</span>
          </Link>
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
                  <span className="dashboard-list-icon" aria-hidden="true">
                    {resource.id === 'onboarding-guide' ? <LuGraduationCap /> : null}
                    {resource.id === 'teams-quick-start' ? <LuBookOpen /> : null}
                    {resource.id === 'report-instructions' ? <LuClipboardList /> : null}
                  </span>
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
          {teamResourceGroups.map((group) => {
            const GroupIcon = teamResourceIcons[group.id as keyof typeof teamResourceIcons]
            return (
              <ContentCard
                key={group.id}
                title={group.title}
                headingLevel="h3"
                className="dashboard-panel dashboard-team-card"
                meta={<span className="dashboard-team-card__marker" aria-hidden="true"><GroupIcon /></span>}
              >
                <ul className="dashboard-team-list">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <Link to={item.href} aria-label={`${item.action} ${item.title}`}>
                        <span>{item.action}</span><LuArrowRight aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </ContentCard>
            )
          })}
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
                <td><time dateTime={submission.dateTime}>{submission.date}</time></td>
                <td><StatusBadge tone={submissionTone(submission.status)}>{submission.status}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </DashboardTable>
      </section>
    </div>
  )
}
