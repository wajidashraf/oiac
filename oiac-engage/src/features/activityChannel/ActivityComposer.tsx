import { useEffect, useId, useRef, useState } from 'react'
import type { ActivityAuthor } from './activityTypes'
import { ActivityIdentity } from './activityPresentation'
import { ActivityValidationError } from './activityService'
type Props = { kind: 'Activity' | 'Comment' | 'Reply'; author: ActivityAuthor; onSave: (content: string, requestId: string) => Promise<void>; onSaved?: () => void; collapsible?: boolean; hidden?: boolean; onCancel?: () => void }
export default function ActivityComposer({ kind, author, onSave, onSaved, collapsible = false, hidden = false, onCancel }: Props) {
  const [open, setOpen] = useState(!collapsible); const [content, setContent] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false); const request = useRef<string | null>(null); const input = useRef<HTMLTextAreaElement>(null); const trigger = useRef<HTMLButtonElement>(null); const id = useId()
  const wasOpen = useRef(open)
  const uncertain = useRef(false)
  const [draftLocked, setDraftLocked] = useState(false)
  useEffect(() => { if (open && !hidden && (collapsible || kind === 'Reply')) input.current?.focus(); if (!open && wasOpen.current) trigger.current?.focus(); wasOpen.current = open }, [open, hidden, collapsible, kind])
  async function submit() {
    if (lock.current || !content.trim() || content.length > 8000) return
    lock.current = true; setBusy(true); setError(''); request.current ??= crypto.randomUUID()
    try {
      await onSave(content, request.current)
      request.current = null
      uncertain.current = false
      setDraftLocked(false)
      setContent('')
      if (collapsible) { setOpen(false); trigger.current?.focus() }
      onSaved?.()
    } catch (e) {
      // A later rejection cannot prove an earlier uncertain attempt did not write.
      if (e instanceof ActivityValidationError && !uncertain.current) {
        request.current = null
        setDraftLocked(false)
      } else {
        uncertain.current = true
        setDraftLocked(true)
      }
      setError(e instanceof Error ? e.message : 'Could not save. Retry this draft.')
    }
    finally { lock.current = false; setBusy(false) }
  }
  return <div hidden={hidden} className={kind === 'Activity' ? 'ac-compose-wrap' : 'ac-inline-compose'}>
    {collapsible && !open ? <div className="ac-create"><span className="ac-plus" aria-hidden="true">+</span><span><strong>Create Activity</strong><small>Share an update with the OIAC community</small></span><button ref={trigger} className="button button--primary ac-open" type="button" aria-label="Create Activity" onClick={() => setOpen(true)}>Open</button></div> : null}
    <form hidden={!open} aria-label={kind === 'Activity' ? 'Create Activity' : `Add ${kind}`} className={kind === 'Activity' ? 'ac-composer' : 'ac-comment-form'} onSubmit={e => { e.preventDefault(); void submit() }}>
      {kind === 'Activity' && <div className="ac-composer-heading"><div className="ac-author"><ActivityIdentity author={author} /><h2>Create Activity</h2></div><button type="button" className="button button--quiet" disabled={busy} onClick={() => { setOpen(false); trigger.current?.focus() }}>Cancel</button></div>}
      <label className="ac-sr" htmlFor={id}>{kind} content</label><textarea ref={input} id={id} maxLength={8000} value={content} readOnly={busy || draftLocked} onChange={e => { setContent(e.target.value); setError('') }} placeholder={kind === 'Activity' ? 'What would you like to share?' : `Write a ${kind.toLowerCase()}…`} rows={kind === 'Activity' ? 5 : 2} />
      {error && <div role="alert" className="ac-error"><span>{error}</span> {draftLocked ? 'Retry to confirm this save. Your draft is retained.' : 'Correct your draft and try again.'}</div>}
      <div className="ac-composer-footer"><span>{kind === 'Activity' ? 'Visible to the OIAC community' : `${content.length}/8000`}</span><div>{onCancel && <button type="button" className="button button--quiet" disabled={busy} onClick={onCancel}>Cancel reply</button>}<button className="button button--primary" type="submit" disabled={busy || !content.trim() || content.length > 8000}>{busy ? 'Saving…' : `Post ${kind}`}</button></div></div>
    </form>
  </div>
}
