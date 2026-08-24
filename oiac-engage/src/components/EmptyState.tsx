type EmptyStateProps = {
  title: string
  description: string
  headingLevel?: 'h2' | 'h3'
}

export default function EmptyState({ title, description, headingLevel = 'h2' }: EmptyStateProps) {
  const Heading = headingLevel
  const headingId = `empty-${title.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <section className="empty-state" aria-labelledby={headingId}>
      <Heading id={headingId}>{title}</Heading>
      <p>{description}</p>
    </section>
  )
}
