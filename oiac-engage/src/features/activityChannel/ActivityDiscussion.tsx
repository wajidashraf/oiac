import { useState } from 'react'
import type { ActivityAuthor, ActivityComment } from './activityTypes'
import ActivityComposer from './ActivityComposer'
import { ActivityIdentity, ActivityText, ActivityTime, buildThread } from './activityPresentation'
type Props = { comments: ActivityComment[]; author: ActivityAuthor; canLoad: boolean; busy: boolean; error?: string; onLoad: () => void; onSave: (content: string, requestId: string, parentId?: string) => Promise<void> }
export default function ActivityDiscussion({ comments, author, canLoad, busy, error, onLoad, onSave }: Props) {
  const [expanded, setExpanded] = useState(false)
  const rows = buildThread(comments)
  const byId = new Map(comments.map(c => [c.id, c]))
  const firstRoot = rows.find(({ comment }) => !comment.parentId)?.comment
  const firstChild = firstRoot && rows.find(({ comment }) => comment.parentId === firstRoot.id)?.comment
  const preview = new Set([firstRoot?.id, firstChild?.id].filter((id): id is string => !!id))
  const hasHidden = !expanded && rows.some(({ comment }) => !preview.has(comment.id))
  const [replyTo, setReplyTo] = useState<string | null>(null); const [opened, setOpened] = useState<Set<string>>(new Set())
  return <section className="ac-discussion" aria-label="Discussion"><h3>Discussion <span>({comments.length}{canLoad ? '+' : ''})</span></h3>
    {rows.map(({ comment, depth, missingContext }) => <div key={comment.id} hidden={!expanded && !preview.has(comment.id)} className={`ac-thread ac-thread--${depth}`}>
      {missingContext && <p className="ac-context">Earlier conversation context is not loaded.{canLoad && <button type="button" onClick={onLoad} disabled={busy}>Load earlier context</button>}</p>}
      <div className="ac-comment"><span className="ac-comment-avatar"><ActivityIdentity author={comment.author} /></span><div className="ac-comment-main"><div className="ac-comment-bubble"><div className="ac-comment-meta"><strong>{comment.author.name}</strong><ActivityTime value={comment.createdOn} /></div>{comment.author.jobTitle && <small>{comment.author.jobTitle}</small>}{comment.parentId && !missingContext && <small className="ac-reply-context">Reply to {byId.get(comment.parentId)?.author.name ?? 'earlier comment'}</small>}<ActivityText content={comment.content} /></div>{!comment.parentId && <button className="ac-reply" type="button" aria-label={`Reply to ${comment.author.name}`} aria-expanded={replyTo === comment.id} onClick={() => { setOpened(v => new Set(v).add(comment.id)); setReplyTo(comment.id) }}>Reply</button>}
        {opened.has(comment.id) && <ActivityComposer kind="Reply" author={author} hidden={replyTo !== comment.id} onCancel={() => setReplyTo(null)} onSaved={() => setReplyTo(current => current === comment.id ? null : current)} onSave={(content, requestId) => onSave(content, requestId, comment.id)} />}
      </div></div></div>)}
    {error && <p role="alert" className="ac-error">{error}</p>}{(hasHidden || canLoad || error) && <button className="button button--quiet ac-load-comments" type="button" aria-expanded={expanded} disabled={busy} onClick={() => { setExpanded(true); if (canLoad || error) onLoad() }}>{busy ? 'Loading comments…' : error ? 'Retry comments' : expanded ? 'Show more' : 'View Comments'}</button>}
    <ActivityComposer kind="Comment" author={author} onSave={(content, requestId) => onSave(content, requestId)} />
  </section>
}
