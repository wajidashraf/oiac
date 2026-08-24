type EmptyStateProps = {
  title: string
  description: string
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby={`empty-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h2 id={`empty-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
