import { powerPagesFetch } from '../../shared/powerPagesApi'
import type { ActivityAuthor, ActivityComment, ActivityCommentPage, ActivityFeedPage, ActivityPost } from './activityTypes'
export const ACTIVITY_ENDPOINT = '/_api/serverlogics/activity-channel'
const messages: Record<string, string> = { validation: 'Check the activity fields and try again.', unauthenticated: 'Sign in to continue.', forbidden: 'You do not have permission to perform this action.', not_found: 'This activity is no longer available.', conflict: 'This activity changed. Refresh it and try again.', unavailable: 'Activity Channel is temporarily unavailable.' }
export class ActivityConflictError extends Error { constructor() { super(messages.conflict); this.name = 'ActivityConflictError' } }
export class ActivityValidationError extends Error {
  constructor() {
    super(messages.validation)
    this.name = 'ActivityValidationError'
  }
}
function invalid(): never { throw new Error(messages.unavailable) }
function object(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid(); return v as Record<string, unknown> }
function parse(v: unknown): unknown { if (typeof v !== 'string') return v; try { return JSON.parse(v) as unknown } catch { return invalid() } }
function id(v: unknown): string { if (typeof v !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(v)) return invalid(); return v.toLowerCase() }
function text(v: unknown): string { if (typeof v !== 'string' || !v.trim() || v.length > 8000) return invalid(); return v }
function bool(v: unknown): boolean { if (typeof v !== 'boolean') return invalid(); return v }
function date(v: unknown): string { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 19) !== v.slice(0, 19)) return invalid(); return v }
function version(v: unknown): string { if (typeof v !== 'string' || !/^[1-9]\d{0,29}$/.test(v)) return invalid(); return v }
function author(v: unknown): ActivityAuthor { const a = object(v); return { id: a.id === null ? null : id(a.id), name: text(a.name), jobTitle: a.jobTitle === null ? null : text(a.jobTitle) } }
function post(v: unknown): ActivityPost { const p = object(v); return { id: id(p.id), content: text(p.content), author: author(p.author), createdOn: date(p.createdOn), modifiedOn: date(p.modifiedOn), isPinned: bool(p.isPinned), pinnedOn: p.pinnedOn === null ? null : date(p.pinnedOn), pinnedById: p.pinnedById === null ? null : id(p.pinnedById), rowVersion: version(p.rowVersion), canDelete: bool(p.canDelete), canModerate: bool(p.canModerate) } }
function comment(v: unknown): ActivityComment { const c = object(v); return { id: id(c.id), postId: id(c.postId), parentId: c.parentId === null ? null : id(c.parentId), content: text(c.content), author: author(c.author), createdOn: date(c.createdOn) } }
function cursor(v: unknown, comments = false): string | null { if (v === null) return null; if (typeof v !== 'string' || !(comments ? /^comments:[1-9]\d*$/ : /^(pinned|regular):[1-9]\d*$/).test(v) || Number(v.split(':')[1]) > 2500) return invalid(); return v }
async function command(name: string, payload: unknown): Promise<Record<string, unknown>> {
  let raw: unknown
  try { raw = await powerPagesFetch<unknown>(ACTIVITY_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: name, payload }) }) } catch { return invalid() }
  let body = object(parse(raw))
  if ('success' in body) { if (body.success !== true) return invalid(); body = object(parse(body.data)) }
  if (body.ok === false) {
    const code = object(body.error).code
    if (code === 'conflict') throw new ActivityConflictError()
    if (code === 'validation') throw new ActivityValidationError()
    throw new Error(typeof code === 'string' && Object.keys(messages).includes(code) ? messages[code] : messages.unavailable)
  }
  if (body.ok !== true) return invalid()
  return body
}
async function getActivityPage(next?: string): Promise<ActivityFeedPage> {
  const value = next === undefined ? 'pinned:1' : cursor(next)!
  const [phase, page] = value.split(':')
  const b = await command('feed', { phase, page: Number(page) })
  if (!Array.isArray(b.posts) || b.posts.length > (phase === 'regular' ? 10 : 30) || !(b.totalCount === null || (Number.isSafeInteger(b.totalCount) && Number(b.totalCount) >= 0)) || typeof b.countUnavailable !== 'boolean' || (b.totalCount === null) !== b.countUnavailable) return invalid()
  const nextLink = cursor(b.nextLink)
  if (nextLink !== null && nextLink !== `${phase}:${Number(page) + 1}` && !(phase === 'pinned' && nextLink === 'regular:2')) return invalid()
  return { posts: b.posts.map(post), nextLink, totalCount: b.totalCount as number | null, countUnavailable: b.countUnavailable, currentUser: author(b.currentUser), canModerate: bool(b.canModerate) }
}
// Each response is bounded and its continuation must advance. Do not publish a partial
// pinned stream if a later page fails; a retry starts from the same feed boundary.
export async function getActivities(next?: string): Promise<ActivityFeedPage> {
  let result = await getActivityPage(next)
  const posts = new Map(result.posts.map(p => [p.id, p]))
  while (result.nextLink?.startsWith('pinned:')) {
    result = await getActivityPage(result.nextLink)
    for (const post of result.posts) posts.set(post.id, post)
  }
  return { ...result, posts: [...posts.values()] }
}
export async function getCommentsForPosts(postIds: string[], next?: string): Promise<ActivityCommentPage> {
  if (!Array.isArray(postIds) || !postIds.length || postIds.length > 40) return invalid()
  const ids = postIds.map(id); if (new Set(ids).size !== ids.length) return invalid()
  const page = next === undefined ? 1 : Number(cursor(next, true)!.split(':')[1])
  const b = await command('comments', { postIds: ids, page })
  if (!Array.isArray(b.comments) || b.comments.length > 100) return invalid()
  const comments = b.comments.map(comment); if (comments.some(c => !ids.includes(c.postId))) return invalid()
  const nextLink = cursor(b.nextLink, true)
  if (nextLink !== null && nextLink !== `comments:${page + 1}`) return invalid()
  return { comments, nextLink }
}
export async function createActivity(content: string, requestId: string): Promise<ActivityPost> { return post((await command('post', { content: text(content), requestId: id(requestId) })).post) }
export async function createComment(postId: string, content: string, requestId: string): Promise<ActivityComment> { return comment((await command('comment', { postId: id(postId), content: text(content), requestId: id(requestId) })).comment) }
export async function createReply(postId: string, parentId: string, content: string, requestId: string): Promise<ActivityComment> { return comment((await command('reply', { postId: id(postId), parentId: id(parentId), content: text(content), requestId: id(requestId) })).comment) }
async function moderate(name: string, p: ActivityPost) { const b = await command(name, { id: id(p.id), expectedRowVersion: version(p.rowVersion) }); if (name === 'remove') { if (id(b.id) !== id(p.id)) return invalid(); return null } const result = post(b.post); if (result.id !== id(p.id)) return invalid(); return result }
export async function pinActivity(p: ActivityPost): Promise<ActivityPost> { return (await moderate('pin', p))! }
export async function unpinActivity(p: ActivityPost): Promise<ActivityPost> { return (await moderate('unpin', p))! }
export async function deleteActivity(p: ActivityPost): Promise<void> { await moderate('remove', p) }
