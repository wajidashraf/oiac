import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ActivityDiscussion from './ActivityDiscussion'
import type { ActivityComment } from './activityTypes'

const author = { id: 'member', name: 'Member', jobTitle: null }
function comment(id: string, parentId: string | null, minute: number): ActivityComment {
  return { id, parentId, postId: 'post', content: id, author: { ...author, name: id }, createdOn: `2026-10-20T10:${String(minute).padStart(2, '0')}:00Z` }
}
const comments = [comment('root', null, 1), comment('first child', 'root', 2), comment('legacy grandchild', 'first child', 3), comment('second child', 'root', 4), comment('second root', null, 5), comment('other child', 'second root', 6)]

test('previews only the first root and first direct child, then reveals all loaded comments without a fetch', async () => {
  const onLoad = vi.fn()
  render(<ActivityDiscussion comments={[...comments].reverse()} author={author} canLoad={false} busy={false} onLoad={onLoad} onSave={async () => {}} />)
  expect(screen.getByText('root', { selector: '.ac-text p' })).toBeVisible()
  expect(screen.getByText('first child', { selector: '.ac-text p' })).toBeVisible()
  for (const id of ['legacy grandchild', 'second child', 'second root', 'other child']) expect(screen.getByText(id, { selector: '.ac-text p' })).not.toBeVisible()
  expect(screen.queryByRole('button', { name: 'Reply to first child' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'View Comments' }))
  for (const id of ['legacy grandchild', 'second child', 'second root', 'other child']) expect(screen.getByText(id, { selector: '.ac-text p' })).toBeVisible()
  expect(screen.getAllByRole('button', { name: /^Reply to / })).toHaveLength(2)
  expect(screen.getByText('legacy grandchild', { selector: '.ac-text p' }).closest('.ac-thread')).toHaveClass('ac-thread--1')
  expect(screen.getByText('Reply to first child', { selector: 'small' })).toBeVisible()
  expect(onLoad).not.toHaveBeenCalled()
})

test('waits for a direct child rather than previewing an orphan or another roots child', async () => {
  render(<ActivityDiscussion comments={[comment('orphan', 'missing', 0), comment('root', null, 1), comment('other root', null, 2), comment('other child', 'other root', 3)]} author={author} canLoad={false} busy={false} onLoad={() => {}} onSave={async () => {}} />)
  expect(screen.getByText('root', { selector: '.ac-text p' })).toBeVisible()
  for (const id of ['orphan', 'other root', 'other child']) expect(screen.getByText(id, { selector: '.ac-text p' })).not.toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'View Comments' }))
  expect(screen.getByText('orphan', { selector: '.ac-text p' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Reply to orphan' })).not.toBeInTheDocument()
})

test('retains hidden root drafts and a delayed save leaves another root composer open', async () => {
  let resolve!: () => void
  const onSave = vi.fn(() => new Promise<void>(r => { resolve = r }))
  render(<ActivityDiscussion comments={comments} author={author} canLoad={false} busy={false} onLoad={() => {}} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Reply to root' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Reply content' }), 'First draft')
  await userEvent.click(screen.getByRole('button', { name: 'View Comments' }))
  await userEvent.click(screen.getByRole('button', { name: 'Reply to second root' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Reply content' }), 'Second draft')
  await userEvent.click(screen.getByRole('button', { name: 'Reply to root' }))
  expect(screen.getByRole('textbox', { name: 'Reply content' })).toHaveValue('First draft')
  await userEvent.click(screen.getByRole('button', { name: 'Post Reply' }))
  await userEvent.click(screen.getByRole('button', { name: 'Reply to second root' }))
  await act(async () => { resolve() })
  expect(screen.getByRole('textbox', { name: 'Reply content' })).toHaveValue('Second draft')
  expect(onSave).toHaveBeenCalledWith('First draft', expect.any(String), 'root')
})
