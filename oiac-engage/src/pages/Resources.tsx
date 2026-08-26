import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { resources, type ResourceRecord } from '../data/resources'

type ResourcesProps = {
  items?: readonly ResourceRecord[]
}

export default function Resources({ items = resources }: ResourcesProps) {
  useEffect(() => {
    document.title = 'Resources — OIAC Engage'
  }, [])

  return (
    <div className="page page--resources">
      <PageHeader
        eyebrow="Member library"
        title="Resources"
        description="Useful OIAC links and member portal destinations in one place."
      />
      {items.length === 0 ? (
        <EmptyState
          title="No resources available"
          description="Resources will appear here when they are available."
        />
      ) : (
        <ul className="resource-grid">
          {items.map((resource) => (
            <li key={resource.id}>
              {resource.destination === 'external' ? (
                <a
                  className="resource-card"
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ResourceCardContent resource={resource} />
                </a>
              ) : (
                <Link className="resource-card" to={resource.href}>
                  <ResourceCardContent resource={resource} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResourceCardContent({ resource }: { resource: ResourceRecord }) {
  return (
    <>
      <span className="resource-card__type">{resource.type}</span>
      <strong>{resource.title}</strong>
      <span className="resource-card__description">{resource.description}</span>
      <span className="resource-card__action">
        {resource.destination === 'external' ? 'Open website' : 'Open resource'}
        <span aria-hidden="true">{resource.destination === 'external' ? ' ↗' : ' →'}</span>
      </span>
    </>
  )
}
