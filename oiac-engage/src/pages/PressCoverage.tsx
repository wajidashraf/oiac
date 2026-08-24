import { useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { pressCoverage, type PressCoverageRecord } from '../data/portalData'

type PressCoverageProps = { items?: readonly PressCoverageRecord[] }

export default function PressCoverage({ items = pressCoverage }: PressCoverageProps) {
  useEffect(() => {
    document.title = 'Press Coverage — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="News and media"
        title="Press Coverage"
        description="Recent reporting and commentary connected to OIAC programmes and member priorities."
      />
      {items.length === 0 ? (
        <EmptyState title="No press coverage yet" description="Published coverage will appear here when it is connected." />
      ) : <>
      <p className="availability-note">Source links will be available after data connection.</p>
      <div className="press-list">
        {items.map((article) => (
          <article key={article.id} className="press-item">
            <div className="press-item__meta">
              <strong>{article.publication}</strong>
              <time>{article.date}</time>
            </div>
            <div className="press-item__content">
              <StatusBadge>{article.topic}</StatusBadge>
              <h2>{article.headline}</h2>
              <p>{article.summary}</p>
            </div>
          </article>
        ))}
      </div>
      </>}
    </div>
  )
}
