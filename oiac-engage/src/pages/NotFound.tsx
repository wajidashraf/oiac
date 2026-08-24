import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — OIAC Engage'
  }, [])

  return (
    <div className="page page--centered">
      <PageHeader
        eyebrow="404"
        title="Page not found"
        description="The page may have moved, or the address may be incomplete."
      />
      <Link className="button button--primary" to="/">Return home</Link>
    </div>
  )
}
