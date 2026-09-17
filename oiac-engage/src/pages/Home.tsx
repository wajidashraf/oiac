import { useEffect, useState, type PropsWithChildren } from 'react'
import {
  LuArrowRight,
  LuBookOpen,
  LuCalendarDays,
  LuClipboardList,
  LuFileText,
  LuGraduationCap,
  LuHandshake,
  LuHash,
  LuExternalLink,
  LuVideo,
} from 'react-icons/lu'
import { Link } from 'react-router-dom'
import ComingSoonBadge from '../components/ComingSoonBadge'
import ContentCard from '../components/ContentCard'
import StatusBadge from '../components/StatusBadge'
import { useHomeDashboardData } from '../features/dashboard/useHomeDashboardData'
import { EventDetailsModal } from '../features/events/EventDetailsModal'
import type { EventItem } from '../features/events/eventTypes'
import { MEETING_INVITATION_STATUS } from '../features/meetingInvites/meetingInviteTypes'
import { TeamAnnouncementModal } from '../features/teamAnnouncements/TeamAnnouncementModal'
import type { TeamAnnouncement } from '../features/teamAnnouncements/teamAnnouncementTypes'
import {
  dashboardMetrics,
  teamResourceGroups,
  trainingResources,
  volunteerSubmissions,
} from '../data/dashboardData'

const dashboardShortcuts = [
  { label: 'Activity', href: '/activity/activity-log', comingSoon: true },
  { label: 'Events', href: '/activity/events', comingSoon: false },
  { label: 'Appointments', href: '/activity/appointments', comingSoon: true },
  { label: 'Resources', href: '/resources', comingSoon: false },
] as const

const teamResourceIcons = {
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

function submissionTone(status: 'Submitted' | 'Confirmed' | 'Completed') {
  if (status === 'Confirmed') return 'positive'
  if (status === 'Submitted') return 'attention'
  return 'neutral'
}

function formatInviteDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date to be confirmed'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
  return `${formatted.replace(/, (?=\d{1,2}:\d{2})/, ' · ')} ET`
}

function formatReportDate(value: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(parsed)
}

function formatEventDate(value: string | null): { day: string; month: string } {
  if (!value) return { day: '—', month: 'TBD' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { day: '—', month: 'TBD' }
  return {
    day: new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed),
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed),
  }
}

type HomeProps = {
  readonly contactId?: string
}

export default function Home({ contactId }: HomeProps) {
  const {
    reports,
    reportCount,
    registeredEventCount,
    upcomingEvents,
    reportsStatus,
    registrationsStatus,
    registrationsFailureKind,
    meetingInvites,
    upcomingMeetings,
    invitesStatus,
    invitesFailureKind,
    acceptingInviteIds,
    inviteError,
    teamAnnouncements,
    announcementsStatus,
    acceptInvite,
    retryInvites,
    retryAnnouncements,
    retry,
  } = useHomeDashboardData(contactId)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<{
    readonly announcement: TeamAnnouncement
    readonly trigger: HTMLButtonElement
  } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<{
    readonly event: EventItem
    readonly trigger: HTMLButtonElement
  } | null>(null)
  const registeredEventsError = registrationsFailureKind === 'processing'
    ? 'Some saved event registration data could not be processed.'
    : 'Your registered events could not be loaded.'
  const meetingInvitesError = invitesFailureKind === 'processing'
    ? 'Some meeting invitation data for this account could not be processed.'
    : 'Meeting invites could not be loaded.'
  const upcomingMeetingsError = invitesFailureKind === 'processing'
    ? 'Returned meeting data could not be processed.'
    : 'Upcoming meetings could not be loaded.'

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
          {dashboardShortcuts.map((shortcut) => shortcut.comingSoon ? (
            <span
              key={shortcut.href}
              className="dashboard-shortcut dashboard-shortcut--disabled dashboard-shortcut--coming-soon"
              aria-disabled="true"
            >
              <span>{shortcut.label}</span>
              <ComingSoonBadge />
            </span>
          ) : (
            <Link className="dashboard-shortcut" key={shortcut.href} to={shortcut.href}>{shortcut.label}</Link>
          ))}
        </nav>
      </header>

      <section className="dashboard-metrics" role="group" aria-label="Volunteer summary">
        {dashboardMetrics.map((metric) => {
          const liveValue = metric.id === 'report-submitted'
            ? reportCount
            : metric.id === 'events-registered'
              ? registeredEventCount
              : metric.value
          return (
            <article className="dashboard-metric" key={metric.id}>
              <strong>{liveValue ?? '—'}</strong>
              <span>{metric.label}</span>
            </article>
          )
        })}
      </section>

      <section className="dashboard-section" aria-labelledby="meeting-reports-title">
        <div className="dashboard-section__heading">
          <h2 id="meeting-reports-title">Meeting Reports</h2>
          <div className="dashboard-section__actions">
            <Link className="button button--quiet dashboard-view-reports" to="/report">View all reports</Link>
            <Link className="button button--primary dashboard-submit-report" to="/report/new">+ Submit Report</Link>
          </div>
        </div>
        {reportsStatus === 'loading' ? <p className="dashboard-report-state" role="status">Loading meeting reports…</p> : null}
        {reportsStatus === 'error' ? (
          <div className="form-alert dashboard-report-state dashboard-report-state--error" role="alert">
            <span>Meeting reports could not be loaded.</span>
            <button className="button button--quiet" type="button" onClick={retry}>Try again</button>
          </div>
        ) : null}
        {reportsStatus === 'ready' && reports.length === 0 ? (
          <p className="dashboard-report-state" role="status">No meeting reports have been submitted yet.</p>
        ) : null}
        {reportsStatus === 'ready' && reports.length > 0 ? (
          <DashboardTable label="Meeting Reports">
            <thead>
              <tr>
                <th scope="col">Meeting</th>
                <th scope="col">Representative</th>
                <th scope="col">Start</th>
                <th scope="col">Outcome</th>
                <th scope="col">District</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <th scope="row">{report.subject}</th>
                  <td>{report.representativeName}</td>
                  <td><time dateTime={report.date}>{formatReportDate(report.date)}</time></td>
                  <td>{report.sentimentLabel}</td>
                  <td>{report.districtName}</td>
                  <td><Link aria-label={`Edit ${report.subject}`} to={`/report/${report.id}/edit`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </DashboardTable>
        ) : null}
      </section>

      <section className="dashboard-operational-grid" aria-label="Volunteer schedule and updates">
        <ContentCard title="Upcoming Events" headingLevel="h2" className="dashboard-panel">
          {registrationsStatus === 'loading' ? (
            <p className="dashboard-report-state" role="status">Loading registered eventsâ€¦</p>
          ) : null}
          {registrationsStatus === 'error' ? (
            <div className="form-alert dashboard-report-state dashboard-report-state--error" role="alert">
              <span>{registeredEventsError}</span>
              <button className="button button--quiet" type="button" onClick={retry}>Try again</button>
            </div>
          ) : null}
          {registrationsStatus === 'ready' && upcomingEvents.length === 0 ? (
            <div className="dashboard-report-state dashboard-event-state">
              <p>You have no registered events yet. Browse available events and select Add to Calendar to register.</p>
              <Link className="button button--quiet" to="/activity/events">Browse events</Link>
            </div>
          ) : null}
          {registrationsStatus === 'ready' && upcomingEvents.length > 0 ? (
            <ul className="dashboard-event-list">
              {upcomingEvents.map((event) => {
                const date = formatEventDate(event.startDateTime)
                return (
                  <li key={event.id}>
                    <time className="dashboard-date-tile" dateTime={event.startDateTime ?? undefined}>
                      <strong>{date.day}</strong>
                      <span>{date.month}</span>
                    </time>
                    <button
                      className="event-title-button dashboard-event-list__title"
                      type="button"
                      onClick={(clickEvent) => setSelectedEvent({
                        event,
                        trigger: clickEvent.currentTarget,
                      })}
                    >
                      {event.title}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <Link className="dashboard-panel__footer-link" to="/my-calendar">
            <span>See all</span><LuArrowRight aria-hidden="true" /><span>My Calendar</span>
          </Link>
        </ContentCard>

        <ContentCard title="Meeting Invites" headingLevel="h2" className="dashboard-panel">
          {invitesStatus === 'loading' ? (
            <p className="dashboard-report-state" role="status">Loading meeting invites…</p>
          ) : null}
          {invitesStatus === 'error' ? (
            <div className="form-alert dashboard-report-state dashboard-report-state--error" role="alert">
              <span>{meetingInvitesError}</span>
              <button
                className="button button--quiet"
                type="button"
                aria-label="Try loading meeting invites again"
                onClick={retryInvites}
              >
                Try again
              </button>
            </div>
          ) : null}
          {inviteError ? (
            <p className="dashboard-invite-error" role="alert">{inviteError}</p>
          ) : null}
          {invitesStatus === 'ready' && meetingInvites.length === 0 ? (
            <p className="dashboard-report-state" role="status">You have no meeting invites.</p>
          ) : null}
          {invitesStatus === 'ready' && meetingInvites.length > 0 ? (
            <div
              className="dashboard-invite-scroll"
              role="region"
              aria-label="Meeting Invites list"
              tabIndex={0}
            >
              <ul className="dashboard-invite-list">
                {meetingInvites.map((invite) => {
                  const isAccepted = invite.participant?.status === MEETING_INVITATION_STATUS.accepted
                  const isAccepting = acceptingInviteIds.has(invite.id)
                  return (
                    <li key={invite.id}>
                      <div>
                        <strong>{invite.title}</strong>
                        <time dateTime={invite.startDateTime}>{formatInviteDate(invite.startDateTime)}</time>
                      </div>
                      {isAccepted ? (
                        <StatusBadge tone="positive">Accepted</StatusBadge>
                      ) : (
                        <button
                          className="dashboard-invite-accept"
                          type="button"
                          disabled={isAccepting}
                          aria-label={`${isAccepting ? 'Accepting' : 'Accept'} ${invite.title}`}
                          onClick={() => void acceptInvite(invite.id)}
                        >
                          {isAccepting ? 'Accepting…' : 'Accept'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </ContentCard>

        <div className="dashboard-panel-stack">
          <ContentCard title="Teams Announcements" headingLevel="h2" className="dashboard-panel">
            {announcementsStatus === 'loading' ? (
              <p className="dashboard-report-state" role="status">Loading Teams announcements…</p>
            ) : null}
            {announcementsStatus === 'error' ? (
              <div className="form-alert dashboard-report-state dashboard-report-state--error" role="alert">
                <span>Teams announcements could not be loaded.</span>
                <button
                  className="button button--quiet"
                  type="button"
                  aria-label="Try loading Teams announcements again"
                  onClick={retryAnnouncements}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {announcementsStatus === 'ready' && teamAnnouncements.length === 0 ? (
              <p className="dashboard-report-state" role="status">
                There are no active Teams announcements.
              </p>
            ) : null}
            {announcementsStatus === 'ready' && teamAnnouncements.length > 0 ? (
              <div
                className="dashboard-announcement-scroll"
                role="region"
                aria-label="Teams Announcements list"
                tabIndex={0}
              >
                <ul className="dashboard-announcement-list">
                  {teamAnnouncements.map((announcement) => (
                    <li key={announcement.id}>
                      <button
                        className="dashboard-announcement-row"
                        type="button"
                        aria-label={`View ${announcement.title}`}
                        onClick={(event) => setSelectedAnnouncement({
                          announcement,
                          trigger: event.currentTarget,
                        })}
                      >
                        <span className="dashboard-announcement-row__details">
                          <strong>{announcement.title}</strong>
                          <time dateTime={announcement.startDateTime}>
                            {formatInviteDate(announcement.startDateTime)}
                          </time>
                        </span>
                        {announcement.link ? (
                          <span
                            className="dashboard-announcement-row__link"
                            aria-label={`${announcement.title} has an external link`}
                          >
                            <LuExternalLink aria-hidden="true" />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ContentCard>

          <ContentCard
            title="Training Resources"
            headingLevel="h2"
            className="dashboard-panel"
          >
            <ul className="dashboard-training-list">
              {trainingResources.map((resource) => (
                <li key={resource.id}>
                  <Link className="dashboard-training-list__link" to={resource.href}>
                    <span className="dashboard-list-icon" aria-hidden="true">
                      {resource.id === 'onboarding-guide' ? <LuGraduationCap /> : null}
                      {resource.id === 'teams-quick-start' ? <LuBookOpen /> : null}
                      {resource.id === 'report-instructions' ? <LuClipboardList /> : null}
                    </span>
                    <span className="dashboard-training-list__label">{resource.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </ContentCard>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="teams-resources-title">
        <div className="dashboard-section__heading">
          <h2 id="teams-resources-title">Teams &amp; Resources</h2>
          <div className="dashboard-section__labels">
            <span className="dashboard-admin-label">Managed by Admin</span>
          </div>
        </div>
        <div className="dashboard-resource-grid">
          <ContentCard
            title="Upcoming Meetings"
            headingLevel="h3"
            className="dashboard-panel dashboard-team-card"
            meta={<span className="dashboard-team-card__marker" aria-hidden="true"><LuCalendarDays /></span>}
          >
            {invitesStatus === 'loading' ? (
              <p className="dashboard-report-state" role="status">Loading upcoming meetings…</p>
            ) : null}
            {invitesStatus === 'error' ? (
              <div className="form-alert dashboard-report-state dashboard-report-state--error" role="alert">
                <span>{upcomingMeetingsError}</span>
                <button
                  className="button button--quiet"
                  type="button"
                  aria-label="Try loading upcoming meetings again"
                  onClick={retryInvites}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {invitesStatus === 'ready' && upcomingMeetings.length === 0 ? (
              <p className="dashboard-report-state" role="status">No upcoming meetings.</p>
            ) : null}
            {invitesStatus === 'ready' && upcomingMeetings.length > 0 ? (
              <ul className="dashboard-team-list">
                {upcomingMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <div>
                      <strong>{meeting.title}</strong>
                      <time dateTime={meeting.startDateTime}>
                        {formatInviteDate(meeting.startDateTime)}
                      </time>
                    </div>
                    {meeting.meetingLink ? (
                      <a
                        className="dashboard-team-list__action dashboard-team-list__action--link"
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Join ${meeting.title} in a new tab`}
                      >
                        <LuVideo aria-hidden="true" />
                        <span>Join Link</span>
                      </a>
                    ) : (
                      <span className="dashboard-team-list__action dashboard-team-list__action--unavailable">
                        Link unavailable
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </ContentCard>
          {teamResourceGroups.map((group) => {
            const GroupIcon = teamResourceIcons[group.id as keyof typeof teamResourceIcons]
            return (
              <ContentCard
                key={group.id}
                title={group.title}
                headingLevel="h3"
                className="dashboard-panel dashboard-team-card dashboard-panel--coming-soon"
                ariaDisabled
                meta={(
                  <>
                    <span className="dashboard-team-card__marker" aria-hidden="true"><GroupIcon /></span>
                    <ComingSoonBadge />
                  </>
                )}
              >
                <ul className="dashboard-team-list">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <span
                        className="dashboard-team-list__action"
                        aria-label={`${item.action} ${item.title}`}
                        aria-disabled="true"
                      >
                        <span>{item.action}</span><LuArrowRight aria-hidden="true" />
                      </span>
                    </li>
                  ))}
                </ul>
              </ContentCard>
            )
          })}
        </div>
      </section>

      <section
        className="dashboard-section dashboard-section--coming-soon"
        aria-labelledby="volunteer-submissions-title"
        aria-disabled="true"
      >
        <div className="dashboard-section__heading">
          <h2 id="volunteer-submissions-title">Volunteer Submissions</h2>
          <ComingSoonBadge />
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
      {selectedAnnouncement ? (
        <TeamAnnouncementModal
          announcement={selectedAnnouncement.announcement}
          formattedStartDate={formatInviteDate(selectedAnnouncement.announcement.startDateTime)}
          returnFocusTo={selectedAnnouncement.trigger}
          onClose={() => setSelectedAnnouncement(null)}
        />
      ) : null}
      {selectedEvent ? (
        <EventDetailsModal
          event={selectedEvent.event}
          returnFocusTo={selectedEvent.trigger}
          onClose={() => setSelectedEvent(null)}
        />
      ) : null}
    </div>
  )
}
