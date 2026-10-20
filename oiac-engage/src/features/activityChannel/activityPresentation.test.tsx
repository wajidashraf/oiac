import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ActivityText, ActivityTime, buildThread, safeActivityUrl } from './activityPresentation'
import { vi } from 'vitest'
import type { ActivityComment } from './activityTypes'
test('renders literal HTML and only safe HTTP links while preserving paragraphs', () => {
  const { container } = render(<ActivityText content={'<img src=x onerror=alert(1)>\n\nhttps://example.org/path javascript:alert(1) https://name:pass@example.org'} />)
  expect(container.querySelector('img')).toBeNull(); expect(screen.getAllByRole('link')).toHaveLength(1); expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer'); expect(container.querySelectorAll('p')).toHaveLength(2)
  expect(safeActivityUrl('https://example.org/\nattack')).toBeNull()
})
test('orders chronological roots and siblings after a newer saved comment preceded an older page', () => {
  const base = { postId: 'p', content: 'x', author: { id: null, name: 'A', jobTitle: null } }
  const rows = buildThread([{ ...base, id: 'root', parentId: null, createdOn: '2026-10-17T10:00:00Z' }, { ...base, id: 'new', parentId: null, createdOn: '2026-10-17T14:00:00Z' }, { ...base, id: 'reply-new', parentId: 'root', createdOn: '2026-10-17T13:00:00Z' }, { ...base, id: 'reply-old', parentId: 'root', createdOn: '2026-10-17T11:00:00Z' }, { ...base, id: 'old', parentId: null, createdOn: '2026-10-17T12:00:00Z' }])
  expect(rows.map(r => r.comment.id)).toEqual(['root', 'reply-old', 'reply-new', 'old', 'new'])
})
test('uses New York calendar days and preserves full ISO and tooltip for relative timestamps', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T04:00:30Z'))
  try {
    const { rerender } = render(<ActivityTime value="2026-10-18T04:00:10Z" />); expect(screen.getByText('Just now')).toHaveAttribute('datetime', '2026-10-18T04:00:10Z'); expect(screen.getByText('Just now')).toHaveAttribute('title', expect.stringContaining('Oct 18, 2026'))
    rerender(<ActivityTime value="2026-10-18T04:00:00Z" />); expect(screen.getByText('Just now')).toBeInTheDocument()
    vi.setSystemTime(new Date('2026-10-18T05:00:00Z')); rerender(<ActivityTime value="2026-10-18T04:00:00Z" />); expect(screen.getByText(/^Today/)).toBeInTheDocument()
    rerender(<ActivityTime value="2026-10-18T03:59:00Z" />); expect(screen.getByText(/^Yesterday/)).toBeInTheDocument()
    rerender(<ActivityTime value="2026-10-16T03:00:00Z" />); expect(screen.getByText(/Oct 15, 2026/)).toBeInTheDocument()
  } finally { vi.useRealTimers() }
})
test('bounded traversal retains immediate parents and marks orphans and cycles', () => {
  const base = { postId: 'p', content: 'x', createdOn: '', author: { id: null, name: 'A', jobTitle: null } }
  const values: ActivityComment[] = [{ ...base, id: 'a', parentId: null }, { ...base, id: 'b', parentId: 'a' }, { ...base, id: 'c', parentId: 'b' }, { ...base, id: 'd', parentId: 'missing' }, { ...base, id: 'e', parentId: 'f' }, { ...base, id: 'f', parentId: 'e' }]
  const rows = buildThread(values); expect(rows).toHaveLength(6); expect(rows.find(r => r.comment.id === 'c')).toMatchObject({ depth: 1, missingContext: false, comment: { parentId: 'b' } }); expect(rows.find(r => r.comment.id === 'd')).toMatchObject({ depth: 1, missingContext: true }); expect(rows.filter(r => ['e', 'f'].includes(r.comment.id)).some(r => r.missingContext)).toBe(true); expect(rows.every(r => r.depth <= 1)).toBe(true)
})
