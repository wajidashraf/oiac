import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

export default function Report() {
  useEffect(() => {
    document.title = 'Report — OIAC Engage'
  }, [])

  return (
    <div className="page page--centered">
      <PageHeader
        eyebrow="Meeting reports"
        title="Report"
        description="The meeting report page will be designed separately after the volunteer dashboard is finalized."
      />
      <Link className="button button--quiet" to="/">Return to dashboard</Link>
    </div>
  )
}
