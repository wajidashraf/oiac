import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useCoverageNavigationGuard } from './useCoverageNavigationGuard'

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

test('restores the current indexed browser entry when a dirty back navigation is declined', () => {
  window.history.replaceState({ idx: 1 }, '', '/press-coverage')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined)
  const routerListener = vi.fn()
  window.addEventListener('popstate', routerListener)
  const hook = renderHook(() => useCoverageNavigationGuard({ dirty: true, saving: false, pendingFile: false }))
  act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } })) })
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(go).toHaveBeenCalledWith(1)
  expect(routerListener).not.toHaveBeenCalled()
  act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 1 } })) })
  expect(routerListener).not.toHaveBeenCalled()
  expect(confirm).toHaveBeenCalledTimes(1)
  hook.unmount()
  window.removeEventListener('popstate', routerListener)
})

test('allows a confirmed back navigation and restores forward navigation while saving', () => {
  window.history.replaceState({ idx: 2 }, '', '/press-coverage')
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined)
  const routerListener = vi.fn()
  window.addEventListener('popstate', routerListener)
  const hook = renderHook(({ saving }) => useCoverageNavigationGuard({ dirty: true, saving, pendingFile: false }), { initialProps: { saving: false } })
  act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 1 } })) })
  expect(routerListener).toHaveBeenCalledTimes(1)
  hook.rerender({ saving: true })
  act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 3 } })) })
  expect(go).toHaveBeenCalledWith(-2)
  expect(routerListener).toHaveBeenCalledTimes(1)
  expect(hook.result.current).toBe(true)
  hook.unmount()
  window.removeEventListener('popstate', routerListener)
})
