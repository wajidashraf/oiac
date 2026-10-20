import { useEffect, useRef, useState } from 'react'

// Imported by the page before BrowserRouter mounts, so declined history moves
// are intercepted before the router removes the active draft.
let activePopState: ((event: PopStateEvent) => void) | undefined
if (typeof window !== 'undefined') window.addEventListener('popstate', (event) => activePopState?.(event), true)

export function useAppointmentNavigationGuard(state: { dirty: boolean; saving: boolean }) {
  const latest = useRef(state)
  latest.current = state
  const [blocked, setBlocked] = useState(false)
  const active = state.dirty || state.saving
  useEffect(() => { if (!state.saving) setBlocked(false) }, [state.saving])
  useEffect(() => {
    if (!active) return
    let currentIndex: number | null = typeof window.history.state?.idx === 'number' ? window.history.state.idx : null
    let restoring: number | null = null
    let allowUnload = false
    let reset: ReturnType<typeof setTimeout> | undefined
    function mayLeave() {
      if (latest.current.saving) { setBlocked(true); return false }
      return !latest.current.dirty || window.confirm('Discard your unsaved appointment changes?')
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.href === window.location.href) return
      // Saving also locks links opening another tab; keep the pending operation visible.
      if (latest.current.saving) { event.preventDefault(); event.stopImmediatePropagation(); setBlocked(true); return }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (anchor.target && anchor.target.toLowerCase() !== '_self') return
      if (!mayLeave()) { event.preventDefault(); event.stopImmediatePropagation(); return }
      allowUnload = true
      reset = setTimeout(() => { allowUnload = false }, 0)
    }
    function popstate(event: PopStateEvent) {
      const next: unknown = event.state?.idx
      if (typeof next !== 'number' || currentIndex === null) return
      if (restoring !== null) { event.stopImmediatePropagation(); if (next === restoring) restoring = null; return }
      if (next === currentIndex) return
      if (mayLeave()) { currentIndex = next; return }
      event.stopImmediatePropagation(); restoring = currentIndex; window.history.go(currentIndex - next)
    }
    function unload(event: BeforeUnloadEvent) { if (!allowUnload) { event.preventDefault(); event.returnValue = '' } }
    document.addEventListener('click', click, true)
    activePopState = popstate
    window.addEventListener('beforeunload', unload)
    return () => {
      clearTimeout(reset)
      document.removeEventListener('click', click, true)
      if (activePopState === popstate) activePopState = undefined
      window.removeEventListener('beforeunload', unload)
    }
  }, [active])
  return blocked
}
