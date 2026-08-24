import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { reports, type ReportRecord } from '../data/portalData'

type MyReportsProps = { items?: readonly ReportRecord[] }

export default function MyReports({ items = reports }: MyReportsProps) {
  useEffect(() => {
    document.title = 'My Reports — OIAC Engage'
  }, [])

  const availableCount = items.filter((report) => report.status === 'Available').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your records"
        title="My Reports"
        description="Review the reports and statements currently associated with your membership."
      />

      <div className="summary-strip" role="group" aria-label="Report summary">
        <div><strong>{items.length}</strong><span>Total reports</span></div>
        <div><strong>{availableCount}</strong><span>Available now</span></div>
        <div><strong>{items.length - availableCount}</strong><span>In review</span></div>
      </div>

      <ContentCard title="Report library" meta={<span>Static preview data</span>}>
        {items.length === 0 ? (
          <EmptyState headingLevel="h3" title="No reports yet" description="Reports connected to your membership will appear here." />
        ) : <>
        <p className="availability-note">Report details will be available after data connection.</p>
        <ul className="record-list">
          {items.map((report) => (
            <li key={report.id} className="record-list__item">
              <div className="record-list__main">
                <strong>{report.title}</strong>
                <div className="record-list__details">
                  <span>{report.period}</span>
                  <span>Updated {report.updated}</span>
                </div>
              </div>
              <StatusBadge tone={report.status === 'Available' ? 'positive' : 'attention'}>{report.status}</StatusBadge>
            </li>
          ))}
        </ul>
        </>}
      </ContentCard>
    </div>
  )
}
