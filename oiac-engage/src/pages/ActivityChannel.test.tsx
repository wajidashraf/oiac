import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import ActivityChannel from './ActivityChannel'
import * as api from '../features/activityChannel/activityService'
import type { ActivityComment, ActivityPost } from '../features/activityChannel/activityTypes'
vi.mock('../features/activityChannel/activityService', async importOriginal => ({ ...await importOriginal<typeof api>(), getActivities: vi.fn(), getCommentsForPosts: vi.fn(), createActivity: vi.fn(), createComment: vi.fn(), createReply: vi.fn(), pinActivity: vi.fn(), unpinActivity: vi.fn(), deleteActivity: vi.fn() }))
const author = { id: '11111111-1111-4111-8111-111111111111', name: 'Sara Rahimi', jobTitle: 'Volunteer' }
const post: ActivityPost = { id: '22222222-2222-4222-8222-222222222222', content: 'Community update', author, createdOn: '2026-10-17T14:00:00Z', modifiedOn: '2026-10-17T14:00:00Z', isPinned: false, pinnedOn: null, pinnedById: null, rowVersion: '1', canDelete: true, canModerate: true }
const comment: ActivityComment = { id: '33333333-3333-4333-8333-333333333333', postId: post.id, parentId: null, content: 'First conversation', author, createdOn: post.createdOn }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.getActivities).mockResolvedValue({ posts: [post], nextLink: null, totalCount: 1, countUnavailable: false, currentUser: author, canModerate: true }); vi.mocked(api.getCommentsForPosts).mockResolvedValue({ comments: [comment], nextLink: null }); vi.mocked(api.createActivity).mockResolvedValue({ ...post, id: '44444444-4444-4444-8444-444444444444', content: 'New update' }); vi.mocked(api.createComment).mockResolvedValue({ ...comment, id: '55555555-5555-4555-8555-555555555555', content: 'New comment' }); vi.mocked(api.createReply).mockResolvedValue({ ...comment, id: '66666666-6666-4666-8666-666666666666', parentId: comment.id, content: 'Reply text' }) })
function show() { return render(<MemoryRouter><ActivityChannel /></MemoryRouter>) }
test('empty composer cannot submit; failed save retains content and retry identity', async () => {
  vi.mocked(api.createActivity).mockRejectedValueOnce(new Error('Unavailable'))
  show(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /Create Activity/ }))
  expect(screen.getByRole('button', { name: 'Post Activity' })).toBeDisabled()
  await user.type(screen.getByRole('textbox', { name: 'Activity content' }), 'New update')
  await user.click(screen.getByRole('button', { name: 'Post Activity' })); await screen.findByText('Unavailable')
  expect(screen.getByRole('textbox', { name: 'Activity content' })).toHaveValue('New update')
  await user.click(screen.getByRole('button', { name: 'Post Activity' })); await screen.findByText('Activity posted.')
  expect(api.createActivity).toHaveBeenCalledTimes(2)
  expect(vi.mocked(api.createActivity).mock.calls[0]).toEqual(vi.mocked(api.createActivity).mock.calls[1])
  expect(screen.queryByRole('textbox', { name: 'Activity content' })).not.toBeInTheDocument()
})
test('locks repeated synchronous submits until the server responds', async () => {
  let resolve!: (p: ActivityPost) => void; vi.mocked(api.createActivity).mockImplementation(() => new Promise(r => { resolve = r }))
  show(); await userEvent.click(screen.getByRole('button', { name: /Create Activity/ })); fireEvent.change(screen.getByLabelText('Activity content'), { target: { value: 'New update' } })
  const form = screen.getByRole('form', { name: 'Create Activity' }); fireEvent.submit(form); fireEvent.submit(form)
  expect(api.createActivity).toHaveBeenCalledTimes(1); resolve(post); await screen.findByText('Activity posted.')
})
test('comment and reply drafts stay independent with the immediate reply parent', async () => {
  show(); await screen.findByText(comment.content); const user = userEvent.setup()
  await user.type(screen.getByLabelText('Comment content'), 'Keep my comment')
  await user.click(screen.getByRole('button', { name: 'Reply to Sara Rahimi' }))
  await user.type(screen.getByRole('textbox', { name: 'Reply content' }), 'Reply text'); await user.click(screen.getByRole('button', { name: 'Post Reply' }))
  await screen.findByText('Reply posted.'); expect(api.createReply).toHaveBeenCalledWith(post.id, comment.id, 'Reply text', expect.any(String))
  expect(screen.getByLabelText('Comment content')).toHaveValue('Keep my comment')
})
test('truncated batched comments restart an individual post at page one then use its cursor', async () => {
  vi.mocked(api.getCommentsForPosts).mockResolvedValueOnce({ comments: [comment], nextLink: 'comments:2' }).mockResolvedValueOnce({ comments: [comment], nextLink: 'comments:2' }).mockResolvedValueOnce({ comments: [], nextLink: null })
  show(); await userEvent.click(await screen.findByRole('button', { name: 'View Comments' })); await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.getCommentsForPosts).mock.calls[1]).toEqual([[post.id], undefined])
  await userEvent.click(screen.getByRole('button', { name: 'Show more' })); await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(3))
  expect(vi.mocked(api.getCommentsForPosts).mock.calls[2]).toEqual([[post.id], 'comments:2'])
  expect(screen.getAllByText(comment.content)).toHaveLength(1)
})
test('delete requires confirmation and cancel restores the trigger focus', async () => {
  show(); await screen.findByText(post.content); const trigger = screen.getByRole('button', { name: 'Delete Activity' }); await userEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Delete Activity' }); expect(within(dialog).getByText(/permanently/)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); expect(api.deleteActivity).not.toHaveBeenCalled(); expect(trigger).toHaveFocus()
  await userEvent.click(trigger); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Activity' })); await screen.findByText('Activity deleted.'); expect(api.deleteActivity).toHaveBeenCalledWith(post)
})
test('author delete does not imply moderation authority', async () => {
  vi.mocked(api.getActivities).mockResolvedValue({ posts: [{ ...post, canModerate: false }], nextLink: null, totalCount: 1, countUnavailable: false, currentUser: author, canModerate: false })
  show(); await screen.findByText(post.content); expect(screen.getByRole('button', { name: 'Delete Activity' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument()
})
test('child replies cannot open another reply composer while the root still accepts replies', async () => {
  const child = { ...comment, id: '77777777-7777-4777-8777-777777777777', parentId: comment.id, content: 'Child reply', author: { ...author, name: 'Ali Khan' } }
  vi.mocked(api.getCommentsForPosts).mockResolvedValue({ comments: [comment, child], nextLink: null })
  show(); await screen.findByText(child.content)
  expect(screen.queryByRole('button', { name: 'Reply to Ali Khan' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reply to Sara Rahimi' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Reply content' }), 'Reply text')
  await userEvent.click(screen.getByRole('button', { name: 'Post Reply' }))
  await screen.findByText('Reply posted.')
  expect(api.createReply).toHaveBeenCalledWith(post.id, comment.id, 'Reply text', expect.any(String))
})

test('confirmed comment remains saved when its refresh fails, with a retry for reads', async () => {
  vi.mocked(api.getCommentsForPosts).mockResolvedValueOnce({ comments: [], nextLink: null }).mockRejectedValueOnce(new Error('Read unavailable'))
  show(); await screen.findByText(post.content); const user = userEvent.setup(); await user.type(screen.getByLabelText('Comment content'), 'New comment'); await user.click(screen.getByRole('button', { name: 'Post Comment' }))
  await screen.findByText('Comment posted.'); await screen.findByText('Read unavailable'); expect(screen.getByLabelText('Comment content')).toHaveValue(''); expect(screen.getByRole('button', { name: 'Retry comments' })).toBeInTheDocument(); expect(api.createComment).toHaveBeenCalledTimes(1)
})
test('count retry preserves posts beyond the first page and all independent drafts', async () => {
  const later = { ...post, id: '88888888-8888-4888-8888-888888888888', content: 'Later activity' }
  vi.mocked(api.getActivities).mockResolvedValueOnce({ posts: [post], nextLink: 'regular:2', totalCount: null, countUnavailable: true, currentUser: author, canModerate: true }).mockResolvedValueOnce({ posts: [later], nextLink: null, totalCount: null, countUnavailable: true, currentUser: author, canModerate: true }).mockResolvedValueOnce({ posts: [post], nextLink: 'regular:2', totalCount: 2, countUnavailable: false, currentUser: author, canModerate: true })
  show(); await userEvent.click(await screen.findByRole('button', { name: 'Show more' })); await screen.findByText(later.content)
  const fields = screen.getAllByLabelText('Comment content'); await userEvent.type(fields[1], 'Later draft'); await userEvent.click(screen.getByRole('button', { name: 'Retry count' })); await screen.findByText('2 activities'); expect(fields[1]).toHaveValue('Later draft'); expect(screen.getByText(later.content)).toBeInTheDocument()
})
test('pin refresh preserves an unrelated later-page draft and reorders from the beginning', async () => {
  const later = { ...post, id: '88888888-8888-4888-8888-888888888888', content: 'Later activity', canModerate: false }
  const pinned = { ...post, isPinned: true, rowVersion: '2' }
  vi.mocked(api.getActivities).mockResolvedValueOnce({ posts: [post], nextLink: 'regular:2', totalCount: 2, countUnavailable: false, currentUser: author, canModerate: true }).mockResolvedValueOnce({ posts: [later], nextLink: null, totalCount: 2, countUnavailable: false, currentUser: author, canModerate: true }).mockResolvedValueOnce({ posts: [pinned], nextLink: 'regular:2', totalCount: 2, countUnavailable: false, currentUser: author, canModerate: true }); vi.mocked(api.pinActivity).mockResolvedValue(pinned)
  show(); await userEvent.click(await screen.findByRole('button', { name: 'Show more' })); await screen.findByText(later.content); await userEvent.type(screen.getAllByLabelText('Comment content')[1], 'Keep this later draft'); await userEvent.click(screen.getByRole('button', { name: 'Pin' })); await screen.findByText('Activity pinned.'); await waitFor(() => expect(api.getActivities).toHaveBeenCalledTimes(3)); expect(screen.getByText(later.content)).toBeInTheDocument(); expect(screen.getAllByLabelText('Comment content')[1]).toHaveValue('Keep this later draft')
})
test('missing parent has a context load action and Escape traps and restores delete dialog focus', async () => {
  vi.mocked(api.getCommentsForPosts).mockResolvedValue({ comments: [{ ...comment, parentId: '99999999-9999-4999-8999-999999999999' }], nextLink: 'comments:2' })
  show(); await screen.findByText(comment.content); await userEvent.click(screen.getByRole('button', { name: 'View Comments' })); expect(screen.getByRole('button', { name: 'Load earlier context' })).toBeInTheDocument()
  const trigger = screen.getByRole('button', { name: 'Delete Activity' }); await userEvent.click(trigger); const dialog = screen.getByRole('dialog'); const cancel = within(dialog).getByRole('button', { name: 'Cancel' }); expect(cancel).toHaveFocus(); await userEvent.tab({ shift: true }); expect(within(dialog).getByRole('button', { name: 'Delete Activity' })).toHaveFocus(); await userEvent.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus()
})
test('a new regular activity stays below pinned activities', async () => {
  vi.mocked(api.getActivities).mockResolvedValue({ posts: [{ ...post, isPinned: true }], nextLink: null, totalCount: 1, countUnavailable: false, currentUser: author, canModerate: true })
  show(); await screen.findByText(post.content); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); await userEvent.type(screen.getByRole('textbox', { name: 'Activity content' }), 'New update'); await userEvent.click(screen.getByRole('button', { name: 'Post Activity' })); await screen.findByText('Activity posted.')
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('Pinned activity'); expect(screen.getAllByRole('article')[1]).toHaveTextContent('New update')
})
test('cancel and reopen preserve the activity draft and restore keyboard focus', async () => {
  show(); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); await userEvent.type(screen.getByRole('textbox', { name: 'Activity content' }), 'Draft to keep'); await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('button', { name: 'Create Activity' })).toHaveFocus(); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); expect(screen.getByRole('textbox', { name: 'Activity content' })).toHaveValue('Draft to keep')
})
test('a confirmed activity refreshes count and keeps its save success if that read fails', async () => {
  vi.mocked(api.getActivities).mockResolvedValueOnce({ posts: [post], nextLink: null, totalCount: 1, countUnavailable: false, currentUser: author, canModerate: true }).mockRejectedValueOnce(new Error('Feed read unavailable'))
  show(); await screen.findByText(post.content); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); await userEvent.type(screen.getByRole('textbox', { name: 'Activity content' }), 'New update'); await userEvent.click(screen.getByRole('button', { name: 'Post Activity' })); await screen.findByText('Activity posted.'); await waitFor(() => expect(api.getActivities).toHaveBeenCalledTimes(2)); expect(screen.queryByRole('textbox', { name: 'Activity content' })).not.toBeInTheDocument(); expect(screen.getByText('New update')).toBeInTheDocument(); expect(api.createActivity).toHaveBeenCalledTimes(1)
})
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function feed(posts: ActivityPost[], nextLink: string | null = null, totalCount = posts.length) { return { posts, nextLink, totalCount, countUnavailable: false, currentUser: author, canModerate: true } }
test('unpinning an old retained activity sorts it below more than twenty newer regular activities without losing drafts', async () => {
  const old = { ...post, createdOn: '2026-01-01T14:00:00Z', isPinned: true, pinnedOn: post.createdOn }
  const regulars = Array.from({ length: 21 }, (_, i) => ({ ...post, id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, content: `Regular ${i + 1}`, createdOn: new Date(Date.parse(post.createdOn) - i * 1000).toISOString(), canModerate: false }))
  vi.mocked(api.getActivities).mockResolvedValueOnce(feed([old, ...regulars.slice(0, 20)], 'regular:2', 22)).mockResolvedValueOnce(feed([regulars[20]], null, 22)).mockResolvedValueOnce(feed(regulars.slice(0, 20), 'regular:2', 22)); vi.mocked(api.unpinActivity).mockResolvedValue({ ...old, isPinned: false, pinnedOn: null })
  show(); await userEvent.click(await screen.findByRole('button', { name: 'Show more' })); await screen.findByText('Regular 21'); const field = within(screen.getAllByRole('article')[0]).getByRole('textbox', { name: 'Comment content' }); await userEvent.type(field, 'Retained draft'); await userEvent.click(screen.getByRole('button', { name: 'Unpin' })); await screen.findByText('Activity unpinned.')
  await waitFor(() => expect(screen.getAllByRole('article').slice(-1)[0]).toHaveTextContent(post.content)); expect(screen.getAllByRole('article').slice(-2)[0]).toHaveTextContent('Regular 21'); expect(field).toHaveValue('Retained draft')
})
test('a confirmed create during the initial feed starts a fresh read and cannot be replaced by the stale initial response', async () => {
  const initial = deferred<Awaited<ReturnType<typeof api.getActivities>>>(); const refresh = deferred<Awaited<ReturnType<typeof api.getActivities>>>(); const saved = { ...post, id: '44444444-4444-4444-8444-444444444444', content: 'New update' }
  vi.mocked(api.getActivities).mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise)
  show(); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); await userEvent.type(screen.getByRole('textbox', { name: 'Activity content' }), 'New update'); await userEvent.click(screen.getByRole('button', { name: 'Post Activity' })); await screen.findByText('Activity posted.'); await waitFor(() => expect(api.getActivities).toHaveBeenCalledTimes(2))
  await act(async () => { refresh.resolve(feed([saved, post], null, 2)); await refresh.promise }); await screen.findByText('2 activities'); await act(async () => { initial.resolve(feed([post])); await initial.promise }); expect(screen.getByText('New update')).toBeInTheDocument(); expect(screen.getByText('2 activities')).toBeInTheDocument()
})
test('confirmed deletion during feed paging refreshes count and ignores the older page count', async () => {
  const paging = deferred<Awaited<ReturnType<typeof api.getActivities>>>(); const later = { ...post, id: '88888888-8888-4888-8888-888888888888', content: 'Stale later record' }
  vi.mocked(api.getActivities).mockResolvedValueOnce(feed([post], 'regular:2', 2)).mockReturnValueOnce(paging.promise).mockResolvedValueOnce(feed([], null, 0))
  show(); await userEvent.click(await screen.findByRole('button', { name: 'Show more' })); await userEvent.click(screen.getByRole('button', { name: 'Delete Activity' })); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Activity' })); await screen.findByText('Activity deleted.'); await waitFor(() => expect(api.getActivities).toHaveBeenCalledTimes(3)); await screen.findByText('0 activities')
  await act(async () => { paging.resolve(feed([later], null, 2)); await paging.promise }); expect(screen.getByText('0 activities')).toBeInTheDocument(); expect(screen.queryByText(later.content)).not.toBeInTheDocument()
})
test('confirmed comment during older comment paging starts its own refresh and ignores stale paging results', async () => {
  const paging = deferred<Awaited<ReturnType<typeof api.getCommentsForPosts>>>(); const fresh = { ...comment, id: '55555555-5555-4555-8555-555555555555', content: 'New comment', createdOn: '2026-10-17T16:00:00Z' }
  vi.mocked(api.createComment).mockResolvedValue(fresh); vi.mocked(api.getCommentsForPosts).mockResolvedValueOnce({ comments: [comment], nextLink: 'comments:2' }).mockReturnValueOnce(paging.promise).mockResolvedValueOnce({ comments: [comment, fresh], nextLink: null })
  show(); await userEvent.click(await screen.findByRole('button', { name: 'View Comments' })); await userEvent.type(screen.getByRole('textbox', { name: 'Comment content' }), 'New comment'); await userEvent.click(screen.getByRole('button', { name: 'Post Comment' })); await screen.findByText('Comment posted.'); await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(3)); expect(screen.getByRole('textbox', { name: 'Comment content' })).toHaveValue('')
  await act(async () => { paging.resolve({ comments: [{ ...comment, content: 'Stale overwritten text' }], nextLink: 'comments:2' }); await paging.promise }); expect(screen.queryByText('Stale overwritten text')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument(); expect(screen.getByText(fresh.content)).toBeInTheDocument()
})
test('delete success restores focus to the expanded activity composer when its trigger is removed', async () => {
  show(); await screen.findByText(post.content); await userEvent.click(screen.getByRole('button', { name: 'Create Activity' })); await userEvent.click(screen.getByRole('button', { name: 'Delete Activity' })); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Activity' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(screen.getByRole('textbox', { name: 'Activity content' })).toHaveFocus()
})
test('an initial comments batch cannot replace a newer post-save thread refresh or its pagination scope', async () => {
  const batch = deferred<Awaited<ReturnType<typeof api.getCommentsForPosts>>>(); const fresh = { ...comment, id: '55555555-5555-4555-8555-555555555555', content: 'New comment' }
  vi.mocked(api.getCommentsForPosts).mockReturnValueOnce(batch.promise).mockResolvedValueOnce({ comments: [fresh], nextLink: null })
  show(); await screen.findByText(post.content); await userEvent.type(screen.getByRole('textbox', { name: 'Comment content' }), 'New comment'); await userEvent.click(screen.getByRole('button', { name: 'Post Comment' })); await screen.findByText('Comment posted.'); await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(2)); await waitFor(() => expect(screen.getByRole('textbox', { name: 'Comment content' })).toHaveValue(''))
  await act(async () => { batch.resolve({ comments: [comment], nextLink: 'comments:2' }); await batch.promise }); expect(screen.queryByText(comment.content)).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument(); expect(screen.getByText(fresh.content)).toBeInTheDocument()
})

test('shows one root and first direct child, expanding all loaded comments without losing the comment draft', async () => {
  const roots = Array.from({ length: 11 }, (_, i) => ({ ...comment, id: `root-${String(i).padStart(2, '0')}`, content: `Root ${i}` }))
  const replies = [{ ...comment, id: 'child-1', parentId: roots[0].id, content: 'First child' }, { ...comment, id: 'child-2', parentId: roots[0].id, content: 'Second child' }, { ...comment, id: 'deep', parentId: 'child-2', content: 'Deep child' }]
  vi.mocked(api.getCommentsForPosts).mockResolvedValue({ comments: [...roots, ...replies], nextLink: null })
  show(); await screen.findByText('Root 0')
  expect(screen.getByText('Root 0')).toBeVisible()
  expect(screen.getByText('Root 1')).not.toBeVisible()
  expect(screen.getByText('Root 10')).not.toBeVisible()
  expect(screen.getByText('First child')).toBeVisible()
  expect(screen.getByText('Second child')).not.toBeVisible()
  expect(screen.getByText('Deep child')).not.toBeVisible()
  await userEvent.type(screen.getByLabelText('Comment content'), 'Keep draft')
  await userEvent.click(screen.getByRole('button', { name: 'View Comments' }))
  expect(screen.getByText('Second child')).toBeVisible()
  expect(screen.getByText('Deep child')).toBeVisible()
  expect(screen.getByText('Deep child').closest('.ac-thread')).toHaveClass('ac-thread--1')
  expect(screen.getByText('Root 10')).toBeVisible()
  expect(screen.getByLabelText('Comment content')).toHaveValue('Keep draft')
  expect(api.getCommentsForPosts).toHaveBeenCalledTimes(1)
})

test('keeps reply-only continuations reachable and merges duplicates before revealing later roots', async () => {
  const reply = { ...comment, id: 'reply-only', parentId: comment.id, content: 'Reply-only page' }
  const later = { ...comment, id: 'later-root', content: 'Later root' }
  vi.mocked(api.getCommentsForPosts)
    .mockResolvedValueOnce({ comments: [comment], nextLink: 'comments:2' })
    .mockResolvedValueOnce({ comments: [comment], nextLink: 'comments:2' })
    .mockResolvedValueOnce({ comments: [reply], nextLink: 'comments:3' })
    .mockResolvedValueOnce({ comments: [reply, later], nextLink: null })
  show(); await userEvent.click(await screen.findByRole('button', { name: 'View Comments' }))
  await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(2))
  await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
  await screen.findByText('Reply-only page')
  await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
  expect(await screen.findByText('Later root')).toBeVisible()
  expect(screen.getAllByText('Reply-only page')).toHaveLength(1)
  expect(vi.mocked(api.getCommentsForPosts).mock.calls[3]).toEqual([[post.id], 'comments:3'])
})

test('loads bounded comment groups for more than forty initial posts and preserves an empty group continuation', async () => {
  const posts = Array.from({ length: 51 }, (_, i) => ({ ...post, id: `post-${i}`, content: `Activity ${i}`, isPinned: i < 41 }))
  vi.mocked(api.getActivities).mockResolvedValue({ posts, nextLink: null, totalCount: 51, countUnavailable: false, currentUser: author, canModerate: true })
  vi.mocked(api.getCommentsForPosts).mockResolvedValueOnce({ comments: [], nextLink: 'comments:2' }).mockResolvedValueOnce({ comments: [], nextLink: null }).mockResolvedValueOnce({ comments: [], nextLink: 'comments:2' })
  show(); await screen.findByText('Activity 50')
  await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.getCommentsForPosts).mock.calls.map(([ids]) => ids.length)).toEqual([40, 11])
  await userEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'View Comments' }))
  await waitFor(() => expect(api.getCommentsForPosts).toHaveBeenCalledTimes(3))
  expect(vi.mocked(api.getCommentsForPosts).mock.calls[2]).toEqual([[posts[0].id], undefined])
})
