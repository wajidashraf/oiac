import type { PropsWithChildren } from 'react'

type StatusBadgeProps = PropsWithChildren<{
  tone?: 'neutral' | 'positive' | 'attention'
}>

export default function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
