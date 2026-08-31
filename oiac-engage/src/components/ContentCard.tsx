import type { PropsWithChildren, ReactNode } from 'react'

type ContentCardProps = PropsWithChildren<{
  title: string
  meta?: ReactNode
  className?: string
  headingLevel?: 'h2' | 'h3'
  ariaDisabled?: boolean
}>

export default function ContentCard({
  title,
  meta,
  className = '',
  headingLevel = 'h2',
  ariaDisabled = false,
  children,
}: ContentCardProps) {
  const Heading = headingLevel
  return (
    <article className={`content-card ${className}`.trim()} aria-disabled={ariaDisabled || undefined}>
      <div className="content-card__header">
        <Heading>{title}</Heading>
        {meta ? <div className="content-card__meta">{meta}</div> : null}
      </div>
      <div className="content-card__body">{children}</div>
    </article>
  )
}
