import { beforeEach, expect, it, vi } from 'vitest'
import { getActivities, getCommentsForPosts, createActivity, createComment, createReply, pinActivity, unpinActivity, deleteActivity, ActivityConflictError, ActivityValidationError } from './activityService'
import { powerPagesFetch } from '../../shared/powerPagesApi'
vi.mock('../../shared/powerPagesApi', () => ({ powerPagesFetch: vi.fn() }))
const id = '12345678-1234-1234-1234-123456789abc'
const author = { id, name: 'Member', jobTitle: null }
const feed = { ok: true, posts: [], nextLink: null, totalCount: 3, countUnavailable: false, currentUser: author, canModerate: false }
const post = { id, content: 'Hello\n\nWorld', author, createdOn: '2026-10-17T10:00:00Z', modifiedOn: '2026-10-17T10:00:00Z', isPinned: false, pinnedOn: null, pinnedById: null, rowVersion: '1', canDelete: true, canModerate: false }
const comment = { id, postId: id, parentId: null, content: 'Comment', author, createdOn: post.createdOn }
beforeEach(() => vi.resetAllMocks())
it('preserves sanitized typed definitive validation for correction without automatic retries', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: false, error: { code: 'validation', message: 'secret server detail' } })
  const error = await createActivity('Bad\u000btext', id).catch(e => e)
  expect(error.name).toBe('ActivityValidationError')
  expect(error).toBeInstanceOf(ActivityValidationError)
  expect(error.message).toBe('Check the activity fields and try again.')
  expect(powerPagesFetch).toHaveBeenCalledTimes(1)
})
it.each(['transport', 'malformed', 'unknown', 'conflict'])('does not classify %s as definitive validation', async outcome => {
  if (outcome === 'transport') vi.mocked(powerPagesFetch).mockRejectedValue(new Error('secret'))
  else vi.mocked(powerPagesFetch).mockResolvedValue(outcome === 'malformed' ? { success: false } : { ok: false, error: { code: outcome } })
  const error = await createActivity('Uncertain draft', id).catch(e => e)
  expect(error).toBeInstanceOf(Error)
  expect(error.name).not.toBe('ActivityValidationError')
  expect(powerPagesFetch).toHaveBeenCalledTimes(1)
})
it('accepts lowercase transport and exposes honest count', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ success: true, data: JSON.stringify(feed) })
  expect(await getActivities()).toMatchObject({ totalCount: 3, countUnavailable: false })
})
it.each(['https://other.example', 'regular:2501', 'pinned:0'])('rejects unsafe cursor %s before fetch', async cursor => {
  await expect(getActivities(cursor)).rejects.toThrow()
  expect(powerPagesFetch).not.toHaveBeenCalled()
})
it.each([{ success: false, data: feed }, { ...feed, countUnavailable: true }, { ...feed, canModerate: 1 }, { ...feed, totalCount: -1 }, { ...feed, nextLink: 'https://bad' }])('rejects malformed response', async value => {
  vi.mocked(powerPagesFetch).mockResolvedValue(value)
  await expect(getActivities()).rejects.toThrow()
})
it('maps conflict without exposing server text or retrying', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: false, error: { code: 'conflict', message: 'secret' } })
  await expect(createActivity('Hello', id)).rejects.toBeInstanceOf(ActivityConflictError)
  expect(powerPagesFetch).toHaveBeenCalledTimes(1)
})
it.each([{ id: 'bad' }, { rowVersion: '0' }, { createdOn: '2026-02-30T10:00:00Z' }, { modifiedOn: 'today' }, { canDelete: 'true' }, { isPinned: 0 }, { pinnedById: '' }, { author: { ...author, id: 'bad' } }])('rejects invalid post DTO', async patch => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ...feed, posts: [{ ...post, ...patch }] })
  await expect(getActivities()).rejects.toThrow()
})
it('preserves paragraphs and request identity for create without retries', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, post })
  expect(await createActivity(post.content, id)).toEqual(post)
  expect(JSON.parse(String(vi.mocked(powerPagesFetch).mock.calls[0][1]?.body))).toEqual({ command: 'post', payload: { content: post.content, requestId: id } })
})
it.each(['', '  ', 'a'.repeat(8001)])('rejects invalid content before transport', async content => {
  await expect(createActivity(content, id)).rejects.toThrow()
  expect(powerPagesFetch).not.toHaveBeenCalled()
})
it('reads only requested post comments and bounded continuation', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, comments: [comment], nextLink: 'comments:2' })
  expect(await getCommentsForPosts([id])).toEqual({ comments: [comment], nextLink: 'comments:2' })
})
it('creates comment and reply using supplied request identity', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, comment })
  expect(await createComment(id, 'Comment', id)).toEqual(comment)
  expect(await createReply(id, id, 'Comment', id)).toEqual(comment)
})
it('pins, unpins and deletes with optimistic version', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, post })
  expect(await pinActivity(post)).toEqual(post)
  expect(await unpinActivity(post)).toEqual(post)
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, id })
  await expect(deleteActivity(post)).resolves.toBeUndefined()
  expect(JSON.parse(String(vi.mocked(powerPagesFetch).mock.calls[2][1]?.body))).toEqual({ command: 'remove', payload: { id, expectedRowVersion: '1' } })
})
it('rejects backwards feed continuation', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ...feed, nextLink: 'pinned:2' })
  await expect(getActivities('regular:2')).rejects.toThrow()
})
it('rejects backwards comments continuation', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: true, comments: [], nextLink: 'comments:2' })
  await expect(getCommentsForPosts([id], 'comments:2')).rejects.toThrow()
})
it('maps unknown error codes to a friendly unavailable message', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: false, error: { code: '__proto__', message: 'secret' } })
  await expect(getActivities()).rejects.toThrow('Activity Channel is temporarily unavailable.')
})

it('drains every pinned page before returning the first ten regular posts without duplicates', async () => {
  const make = (n: number, pinned: boolean) => ({ ...post, id: `12345678-1234-1234-1234-${String(n).padStart(12, '0')}`, isPinned: pinned })
  const pins = Array.from({ length: 41 }, (_, i) => make(i + 1, true))
  const regular = Array.from({ length: 25 }, (_, i) => make(i + 100, false))
  vi.mocked(powerPagesFetch).mockResolvedValueOnce({ ...feed, posts: pins.slice(0, 20), nextLink: 'pinned:2' })
    .mockResolvedValueOnce({ ...feed, posts: pins.slice(20, 40), nextLink: 'pinned:3' })
    .mockResolvedValueOnce({ ...feed, posts: [pins[40], ...regular.slice(0, 10)], nextLink: 'regular:2' })
    .mockResolvedValueOnce({ ...feed, posts: regular.slice(10, 20), nextLink: 'regular:3' })
    .mockResolvedValueOnce({ ...feed, posts: regular.slice(20), nextLink: null })
  const first = await getActivities()
  expect(first.posts).toEqual([...pins, ...regular.slice(0, 10)])
  const second = await getActivities(first.nextLink!)
  const third = await getActivities(second.nextLink!)
  expect(second.posts).toHaveLength(10)
  expect(third.posts).toHaveLength(5)
  expect(new Set([...first.posts, ...second.posts, ...third.posts].map(p => p.id)).size).toBe(66)
})

it('deduplicates pinned stream ids and rejects a failed continuation instead of returning partial pins', async () => {
  vi.mocked(powerPagesFetch).mockResolvedValueOnce({ ...feed, posts: [post], nextLink: 'pinned:2' }).mockResolvedValueOnce({ ...feed, posts: [post], nextLink: null })
  expect((await getActivities()).posts).toEqual([post])
  vi.mocked(powerPagesFetch).mockResolvedValueOnce({ ...feed, posts: [post], nextLink: 'pinned:2' }).mockRejectedValueOnce(new Error('offline'))
  await expect(getActivities()).rejects.toThrow('temporarily unavailable')
})
