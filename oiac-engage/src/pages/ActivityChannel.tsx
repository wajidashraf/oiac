import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../features/activityChannel/activityService'
import type { ActivityAuthor, ActivityComment, ActivityPost } from '../features/activityChannel/activityTypes'
import ActivityComposer from '../features/activityChannel/ActivityComposer'
import ActivityCard from '../features/activityChannel/ActivityCard'
import ActivityDiscussion from '../features/activityChannel/ActivityDiscussion'
import ActivityDeleteDialog from '../features/activityChannel/ActivityDeleteDialog'
import '../features/activityChannel/activity-channel.css'
type Thread = { comments: ActivityComment[]; next: string | null; batchTruncated: boolean; error: string; busy: boolean }
const emptyThread = (): Thread => ({ comments: [], next: null, batchTruncated: false, error: '', busy: false })
function merge<T extends { id: string }>(old: T[], incoming: T[]) { const values = new Map(old.map(v => [v.id, v])); for (const v of incoming) values.set(v.id, v); return [...values.values()] }
function orderPosts(posts: ActivityPost[]) {
  return posts.sort((a, b) => Number(b.isPinned) - Number(a.isPinned)
    || (a.isPinned && b.isPinned ? Date.parse(b.pinnedOn ?? b.createdOn) - Date.parse(a.pinnedOn ?? a.createdOn) : 0)
    || Date.parse(b.createdOn) - Date.parse(a.createdOn) || a.id.localeCompare(b.id))
}
function message(e: unknown) { return e instanceof Error ? e.message : 'Activity Channel is unavailable. Try again.' }
const unknownAuthor: ActivityAuthor = { id: null, name: 'Community member', jobTitle: null }
export default function ActivityChannel() {
  const [posts, setPosts] = useState<ActivityPost[]>([]); const [author, setAuthor] = useState(unknownAuthor); const [next, setNext] = useState<string | null>(null); const [count, setCount] = useState<number | null>(null); const [countUnavailable, setCountUnavailable] = useState(false); const [ready, setReady] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [threads, setThreads] = useState<Record<string, Thread>>({}); const [moderating, setModerating] = useState<Set<string>>(new Set()); const [deleting, setDeleting] = useState<{ post: ActivityPost; trigger: HTMLElement } | null>(null)
  const feedLock = useRef(false); const threadLocks = useRef(new Set<string>()); const mutationLocks = useRef(new Set<string>()); const mounted = useRef(true); const initializedThreads = useRef(new Set<string>()); const removedIds = useRef(new Set<string>())
  const feedGeneration = useRef(0); const threadGeneration = useRef(new Map<string, number>())
  const updateThread = useCallback((id: string, change: (value: Thread) => Thread) => { if (mounted.current) setThreads(old => ({ ...old, [id]: change(old[id] ?? emptyThread()) })) }, [])
  const batch = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const versions = new Map(ids.map(id => [id, (threadGeneration.current.get(id) ?? 0) + 1]))
    for (const id of ids) { threadGeneration.current.set(id, versions.get(id)!); threadLocks.current.add(id); updateThread(id, t => ({ ...t, busy: true, error: '' })) }
    try { const pages = []
      for (let start = 0; start < ids.length; start += 40) pages.push({ ids: ids.slice(start, start + 40), result: await api.getCommentsForPosts(ids.slice(start, start + 40)) })
      for (const { ids: group, result } of pages) for (const id of group) if (threadGeneration.current.get(id) === versions.get(id)) updateThread(id, t => ({ ...t, comments: merge(t.comments, result.comments.filter(c => c.postId === id)), batchTruncated: !!result.nextLink, busy: false })) }
    catch (e) { for (const id of ids) if (threadGeneration.current.get(id) === versions.get(id)) updateThread(id, t => ({ ...t, error: message(e), busy: false, batchTruncated: true })) }
    finally { for (const id of ids) if (threadGeneration.current.get(id) === versions.get(id)) threadLocks.current.delete(id) }
  }, [updateThread])
  const loadFeed = useCallback(async (cursor?: string, preserve = false, refresh = false) => {
    if (feedLock.current && !refresh) return false
    // Confirmed mutations always start a fresh read; older requests cannot publish.
    const generation = ++feedGeneration.current
    feedLock.current = true; setLoading(true); setError('')
    try { const result = await api.getActivities(cursor); if (!mounted.current || generation !== feedGeneration.current) return false
      const visible = result.posts.filter(p => !removedIds.current.has(p.id))
      setPosts(old => orderPosts(cursor || preserve ? merge(old, visible) : visible)); setNext(result.nextLink); setCount(result.totalCount); setCountUnavailable(result.countUnavailable); setAuthor(result.currentUser); setReady(true)
      const newIds = visible.map(p => p.id).filter(id => !initializedThreads.current.has(id)); newIds.forEach(id => initializedThreads.current.add(id)); void batch(newIds); return true
    } catch (e) { if (mounted.current && generation === feedGeneration.current) { setError(message(e)); setCount(null); setCountUnavailable(true) }; return false }
    finally { if (generation === feedGeneration.current) { feedLock.current = false; if (mounted.current) setLoading(false) } }
  }, [batch])
  useEffect(() => { mounted.current = true; document.title = 'Activity Channel — OIAC Engage'; void loadFeed(); return () => { mounted.current = false } }, [loadFeed])
  async function loadThread(id: string, cursor?: string, refresh = false) {
    if (threadLocks.current.has(id) && !refresh) return
    initializedThreads.current.add(id)
    const generation = (threadGeneration.current.get(id) ?? 0) + 1; threadGeneration.current.set(id, generation)
    threadLocks.current.add(id); updateThread(id, t => ({ ...t, busy: true, error: '' }))
    try { const result = await api.getCommentsForPosts([id], cursor); if (threadGeneration.current.get(id) === generation) updateThread(id, t => ({ ...t, comments: merge(t.comments, result.comments), next: result.nextLink, batchTruncated: false, busy: false })) }
    catch (e) { if (threadGeneration.current.get(id) === generation) updateThread(id, t => ({ ...t, error: message(e), busy: false })) }
    finally { if (threadGeneration.current.get(id) === generation) threadLocks.current.delete(id) }
  }
  async function savePost(content: string, requestId: string) {
    const saved = await api.createActivity(content, requestId); setPosts(old => orderPosts(merge(old, [saved]))); setNotice('Activity posted.'); await loadFeed(undefined, true, true)
  }
  async function saveComment(id: string, content: string, requestId: string, parentId?: string) {
    const saved = parentId ? await api.createReply(id, parentId, content, requestId) : await api.createComment(id, content, requestId)
    updateThread(id, t => ({ ...t, comments: merge(t.comments, [saved]) })); setNotice(parentId ? 'Reply posted.' : 'Comment posted.')
    // Read failures must never turn a confirmed write into a retryable create.
    await loadThread(id, undefined, true)
  }
  async function moderate(post: ActivityPost) {
    if (mutationLocks.current.has(post.id)) return
    mutationLocks.current.add(post.id); setModerating(v => new Set(v).add(post.id)); setError('')
    try { const saved = await (post.isPinned ? api.unpinActivity(post) : api.pinActivity(post)); setPosts(old => orderPosts(merge(old, [saved]))); setNotice(post.isPinned ? 'Activity unpinned.' : 'Activity pinned.'); if (!await loadFeed(undefined, true, true)) setNotice('Activity saved. Refresh the feed to see its current order.') }
    catch (e) { setError(message(e)) }
    finally { mutationLocks.current.delete(post.id); setModerating(v => { const n = new Set(v); n.delete(post.id); return n }) }
  }
  const closeDelete = useCallback(() => setDeleting(null), [])
  async function remove() { if (!deleting) return; const id = deleting.post.id; await api.deleteActivity(deleting.post); removedIds.current.add(id); setPosts(old => old.filter(p => p.id !== id)); setNotice('Activity deleted.'); await loadFeed(undefined, true, true) }
  return <div className="page activity-channel"><Link className="ac-back" to="/">← Back to Dashboard</Link><header className="ac-title"><h1>Activity Channel</h1><p>Share updates, exchange ideas, and stay connected with the OIAC community.</p></header>
    <ActivityComposer kind="Activity" author={author} collapsible onSave={savePost} />
    <section aria-labelledby="ac-feed-title"><div className="ac-feed-heading"><h2 id="ac-feed-title">Community Activities</h2><span className="ac-count">{countUnavailable ? 'Count unavailable' : count === null ? 'Loading count…' : `${count} ${count === 1 ? 'activity' : 'activities'}`}</span>{countUnavailable && <button type="button" className="button button--quiet" disabled={loading} onClick={() => void loadFeed(undefined, true)}>Retry count</button>}</div>
      <p className="ac-notice" role="status">{notice}</p>{error && <div className="ac-error" role="alert">{error} <button type="button" className="button button--quiet" disabled={loading} onClick={() => void loadFeed(undefined, true)}>Retry feed</button></div>}
      {loading && <p role="status">Loading activities…</p>}{ready && !posts.length && <p className="ac-empty">No activities yet. Start a conversation with your community.</p>}
      <div className="ac-feed">{posts.map(post => { const thread = threads[post.id] ?? emptyThread(); return <ActivityCard key={post.id} post={post} busy={moderating.has(post.id)} onPin={() => void moderate(post)} onDelete={trigger => setDeleting({ post, trigger })}><ActivityDiscussion comments={thread.comments} author={author} canLoad={thread.batchTruncated || !!thread.next} busy={thread.busy} error={thread.error} onLoad={() => void loadThread(post.id, thread.batchTruncated ? undefined : thread.next ?? undefined)} onSave={(content, requestId, parentId) => saveComment(post.id, content, requestId, parentId)} /></ActivityCard> })}</div>
      {next && <button className="button button--quiet ac-more" disabled={loading} type="button" onClick={() => void loadFeed(next)}>Show more</button>}
    </section>{deleting && <ActivityDeleteDialog onDelete={remove} onClose={closeDelete} returnFocusTo={deleting.trigger} />}
  </div>
}
