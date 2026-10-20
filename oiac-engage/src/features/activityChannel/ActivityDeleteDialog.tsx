import { useEffect, useId, useRef, useState } from 'react'
export default function ActivityDeleteDialog({ onDelete, onClose, returnFocusTo }: { onDelete: () => Promise<void>; onClose: () => void; returnFocusTo: HTMLElement }) {
  const root = useRef<HTMLDivElement>(null); const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const id = useId()
  useEffect(() => {
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); if (!lock.current) onClose() }
      if (e.key === 'Tab') { const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]; if (!buttons.length) { e.preventDefault(); root.current?.focus(); return }; const first = buttons[0]; const last = buttons[buttons.length - 1]; if (e.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }
    }
    function focus(e: FocusEvent) { if (!root.current?.contains(e.target as Node)) root.current?.focus() }
    document.addEventListener('keydown', key); document.addEventListener('focusin', focus)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); if (returnFocusTo.isConnected) returnFocusTo.focus(); else document.querySelector<HTMLElement>('.activity-channel .ac-open, .activity-channel .ac-composer:not([hidden]) textarea')?.focus() }
  }, [onClose, returnFocusTo])
  async function remove() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await onDelete(); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed. Try again.') } finally { lock.current = false; setBusy(false) } }
  return <div className="ac-dialog-backdrop"><div ref={root} className="ac-delete-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-warning`} tabIndex={-1}><h2 id={`${id}-title`}>Delete Activity</h2><p id={`${id}-warning`}>This will permanently delete this activity and all its comments and replies. This action cannot be undone.</p>{error && <p role="alert">{error}</p>}<div className="ac-dialog-actions"><button className="button button--quiet" disabled={busy} onClick={onClose}>Cancel</button><button className="button button--primary" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete Activity'}</button></div></div></div>
}
