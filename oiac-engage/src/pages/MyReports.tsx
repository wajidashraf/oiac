import { useEffect } from 'react'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { reports } from '../data/portalData'

export default function MyReports() {
  useEffect(() => {
    document.title = 'My Reports — OIAC Engage'
  }, [])

  const availableCount = reports.filter((report) => report.status === 'Available').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your records"
        title="My Reports"
        description="Review the reports and statements currently associated with your membership."
      />

      <div className="summary-strip" aria-label="Report summary">
        <div><strong>{reports.length}</strong><span>Total reports</span></div>
        <div><strong>{availableCount}</strong><span>Available now</span></div>
        <div><strong>{reports.length - availableCount}</strong><span>In review</span></div>
      </div>

      <ContentCard title="Report library" meta={<span>Static preview data</span>}>
        <ul className="record-list">
          {reports.map((report) => (
            <li key={report.id} className="record-list__item">
              <div className="record-list__main">
                <strong>{report.title}</strong>
                <div className="record-list__details">
                  <span>{report.period}</span>
                  <span>Updated {report.updated}</span>
                </div>
              </div>
              <StatusBadge tone={report.status === 'Available' ? 'positive' : 'attention'}>{report.status}</StatusBadge>
              <button type="button" className="button button--quiet" aria-label={`View ${report.title}`}>View</button>
            </li>
          ))}
        </ul>
      </ContentCard>
    </div>
  )
}
