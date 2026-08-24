import { useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { pressCoverage } from '../data/portalData'

export default function PressCoverage() {
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
      <div className="press-list">
        {pressCoverage.map((article) => (
          <article key={article.id} className="press-item">
            <div className="press-item__meta">
              <strong>{article.publication}</strong>
              <time>{article.date}</time>
            </div>
            <div className="press-item__content">
              <StatusBadge>{article.topic}</StatusBadge>
              <h2>{article.headline}</h2>
              <p>{article.summary}</p>
              <button type="button" className="text-action" aria-label={`View coverage: ${article.headline}`}>View coverage <span aria-hidden="true">→</span></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
