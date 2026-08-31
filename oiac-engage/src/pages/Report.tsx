import { useEffect, useRef, useState } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link, useLocation } from 'react-router-dom'
import { getMeetingReports } from '../features/meetingReports/meetingReportService'
import type { MeetingReportSummary } from '../features/meetingReports/meetingReportTypes'

export default function Report() {
  const location = useLocation()
  const saved = Boolean((location.state as { reportSaved?: boolean } | null)?.reportSaved)
  const updated = Boolean((location.state as { reportUpdated?: boolean } | null)?.reportUpdated)
  const [reports, setReports] = useState<readonly MeetingReportSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(1)
  const [nextLink, setNextLink] = useState<string | null>(null)
  const pageLinks = useRef<(string | null)[]>([null])

  useEffect(() => {
    document.title = 'Meeting Reports — OIAC Engage'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const currentNextLink = pageLinks.current[page - 1] ?? null
    setStatus('loading')
    getMeetingReports({ nextLink: currentNextLink }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setReports(result.reports)
        setNextLink(result.nextLink)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('[Report] Meeting Reports request failed', {
          error,
          page,
          hasContinuation: Boolean(currentNextLink),
          signalAborted: controller.signal.aborted,
        })
        setStatus('error')
      })
    return () => controller.abort()
  }, [page, retry])

  function nextPage() {
    if (!nextLink || status === 'loading') return
    pageLinks.current[page] = nextLink
    setPage((current) => current + 1)
  }

  function previousPage() {
    if (status === 'loading') return
    setPage((current) => Math.max(1, current - 1))
  }

  return (
    <div className="page page--meeting-report">
      <Link className="report-page__back" to="/"><LuChevronLeft aria-hidden="true" /><span>Back</span></Link>

      <header className="report-page__header">
        <div><h1>Meeting Reports</h1><p>Submit and track your congressional and organizational meeting reports.</p></div>
        <Link className="button button--primary report-page__submit" to="/report/new">+ Submit Report</Link>
      </header>

      {saved ? <p className="form-success report-page__success" role="status">Report saved.</p> : null}
      {updated ? <p className="form-success report-page__success" role="status">Report updated.</p> : null}
      {status === 'loading' ? <p className="report-page__state" role="status">Loading meeting reports…</p> : null}
      {status === 'error' ? (
        <div className="form-alert report-page__state" role="alert">
          <span>Meeting reports could not be loaded.</span>
          <button className="button button--quiet" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : null}
      {status === 'ready' && reports.length === 0 ? <p className="report-page__state" role="status">No meeting reports have been submitted yet.</p> : null}
      {status === 'ready' && reports.length > 0 ? (
        <>
          <div className="dashboard-table-scroll report-page__table" role="region" aria-label="Meeting Reports table, scroll horizontally" tabIndex={0}>
            <table className="dashboard-table" aria-label="Meeting Reports">
              <thead><tr><th scope="col">Meeting</th><th scope="col">Representative</th><th scope="col">Start</th><th scope="col">Outcome</th><th scope="col" aria-label="Actions" /></tr></thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <th scope="row">{report.subject}</th>
                    <td>{report.representativeName}</td>
                    <td><time dateTime={report.date}>{formatReportDate(report.date)}</time></td>
                    <td>{report.sentimentLabel}</td>
                    <td><Link aria-label={`Edit ${report.subject}`} to={`/report/${report.id}/edit`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="report-page__pagination" aria-label="Meeting Reports pagination">
            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={previousPage}>Previous</button>
            <span className="report-page__page-indicator" aria-live="polite">Page {page}</span>
            <button type="button" aria-label="Next page" disabled={!nextLink} onClick={nextPage}>Next</button>
          </nav>
        </>
      ) : null}
    </div>
  )
}

function formatReportDate(value: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(parsed)
}
