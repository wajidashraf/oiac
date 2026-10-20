import { useEffect, useRef, useState } from 'react'

type GuardState = { dirty: boolean; saving: boolean; pendingFile: boolean }

// App eagerly imports this module before BrowserRouter mounts. At window's
// target phase, browsers invoke popstate listeners in registration order, even
// when capture=true; installing one in an effect would run after the router
// unmounts the draft. This early dispatcher is a no-op outside an active form.
let activePopState: ((event: PopStateEvent) => void) | undefined
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => activePopState?.(event), true)
}

// Restore BrowserRouter's indexed history without patching its navigator or
// adding synthetic history entries. Click interception is local to the form.
export function useCoverageNavigationGuard(state: GuardState): boolean {
  const latest = useRef(state)
  latest.current = state
  const [blockedWhileSaving, setBlockedWhileSaving] = useState(false)
  const active = state.dirty || state.saving
  useEffect(() => { if (!state.saving) setBlockedWhileSaving(false) }, [state.saving])

  useEffect(() => {
    if (!active) return
    let currentIndex: number | null = typeof window.history.state?.idx === 'number' ? window.history.state.idx : null
    let restoringIndex: number | null = null
    let allowUnload = false
    let unloadReset: ReturnType<typeof setTimeout> | undefined
    function mayLeave() {
      if (latest.current.saving) { setBlockedWhileSaving(true); return false }
      return !latest.current.dirty || window.confirm(latest.current.pendingFile
        ? 'The coverage record is saved, but its file has not finished uploading. Leave this form?'
        : 'Discard your unsaved coverage changes?')
    }
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target.toLowerCase() !== '_self')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return
      if (!mayLeave()) { event.preventDefault(); event.stopImmediatePropagation(); return }
      // A normal anchor can trigger beforeunload after this confirmation; avoid
      // asking twice, while resetting immediately if another handler cancels it.
      allowUnload = true
      unloadReset = setTimeout(() => { allowUnload = false }, 0)
    }
    function onPopState(event: PopStateEvent) {
      const nextIndex: unknown = event.state?.idx
      if (typeof nextIndex !== 'number' || currentIndex === null) return
      if (restoringIndex !== null) {
        event.stopImmediatePropagation()
        if (nextIndex === restoringIndex) restoringIndex = null
        return
      }
      if (nextIndex === currentIndex) return
      if (mayLeave()) { currentIndex = nextIndex; return }
      event.stopImmediatePropagation()
      restoringIndex = currentIndex
      window.history.go(currentIndex - nextIndex)
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (allowUnload) return
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('click', onClick, true)
    activePopState = onPopState
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      clearTimeout(unloadReset)
      document.removeEventListener('click', onClick, true)
      if (activePopState === onPopState) activePopState = undefined
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])
  return blockedWhileSaving
}
