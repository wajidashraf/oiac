import type { PropsWithChildren, ReactNode } from 'react'

type ContentCardProps = PropsWithChildren<{
  title: string
  meta?: ReactNode
  className?: string
  headingLevel?: 'h2' | 'h3'
}>

export default function ContentCard({ title, meta, className = '', headingLevel = 'h2', children }: ContentCardProps) {
  const Heading = headingLevel
  return (
    <article className={`content-card ${className}`.trim()}>
      <div className="content-card__header">
        <Heading>{title}</Heading>
        {meta ? <div className="content-card__meta">{meta}</div> : null}
      </div>
      <div className="content-card__body">{children}</div>
    </article>
  )
}
