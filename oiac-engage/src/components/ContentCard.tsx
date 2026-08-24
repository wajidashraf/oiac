import type { PropsWithChildren, ReactNode } from 'react'

type ContentCardProps = PropsWithChildren<{
  title: string
  meta?: ReactNode
  className?: string
}>

export default function ContentCard({ title, meta, className = '', children }: ContentCardProps) {
  return (
    <article className={`content-card ${className}`.trim()}>
      <div className="content-card__header">
        <h2>{title}</h2>
        {meta ? <div className="content-card__meta">{meta}</div> : null}
      </div>
      <div className="content-card__body">{children}</div>
    </article>
  )
}
