import { useEffect } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link, useLocation } from 'react-router-dom'
import { meetingReports } from '../data/dashboardData'

export default function Report() {
  const location = useLocation()
  const saved = Boolean((location.state as { reportSaved?: boolean } | null)?.reportSaved)
  const updated = Boolean((location.state as { reportUpdated?: boolean } | null)?.reportUpdated)

  useEffect(() => {
    document.title = 'Meeting Reports — OIAC Engage'
  }, [])

  return (
    <div className="page page--meeting-report">
      <Link className="report-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="report-page__header">
        <div>
          <h1>Meeting Reports</h1>
          <p>Submit and track your congressional and organizational meeting reports.</p>
        </div>
        <Link className="button button--primary report-page__submit" to="/report/new">+ Submit Report</Link>
      </header>

      {saved ? <p className="form-success report-page__success" role="status">Report saved.</p> : null}
      {updated ? <p className="form-success report-page__success" role="status">Report updated.</p> : null}

      <div
        className="dashboard-table-scroll report-page__table"
        role="region"
        aria-label="Meeting Reports table, scroll horizontally"
        tabIndex={0}
      >
        <table className="dashboard-table" aria-label="Meeting Reports">
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
                <td>
                  <Link aria-label={`Edit ${report.meeting}`} to={`/report/${report.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
