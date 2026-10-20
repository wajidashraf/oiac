import type { ReactNode } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import type { ActivityPost } from './activityTypes'
import { ActivityIdentity, ActivityText, ActivityTime } from './activityPresentation'
export default function ActivityCard({ post, busy, onPin, onDelete, children }: { post: ActivityPost; busy: boolean; onPin: () => void; onDelete: (trigger: HTMLButtonElement) => void; children: ReactNode }) {
  return <article className={`ac-card${post.isPinned ? ' ac-card--pinned' : ''}`} aria-label={`Activity by ${post.author.name}`}>
    {post.isPinned && <div className="ac-pinned">Pinned activity</div>}
    <div className="ac-post"><header className="ac-post-header"><div className="ac-author"><ActivityIdentity author={post.author} /></div><div className="ac-post-actions">{post.canModerate && <button className="button button--quiet" type="button" disabled={busy} onClick={onPin}>{post.isPinned ? 'Unpin' : 'Pin'}</button>}{post.canDelete && <button className="ac-delete" type="button" aria-label="Delete Activity" title="Delete Activity" disabled={busy} onClick={e => onDelete(e.currentTarget)}><FiTrash2 aria-hidden="true" /></button>}</div></header><div className="ac-post-time"><ActivityTime value={post.createdOn} /></div><ActivityText content={post.content} /></div>
    {children}
  </article>
}
