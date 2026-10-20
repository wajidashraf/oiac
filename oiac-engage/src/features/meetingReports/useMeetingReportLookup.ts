import { useCallback, useEffect, useRef, useState } from 'react'

type LookupStatus = 'idle' | 'loading' | 'ready' | 'error'

export type MeetingReportLookupState<T> = {
  readonly search: string
  readonly setSearch: (value: string) => void
  readonly options: readonly T[]
  readonly status: LookupStatus
  readonly retry: () => void
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export function useMeetingReportLookup<T>(
  loader: (search: string, signal?: AbortSignal) => Promise<readonly T[]>,
  debounceMs = 350,
  normalizeSearch?: (search: string) => string,
): MeetingReportLookupState<T> {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [options, setOptions] = useState<readonly T[]>([])
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const requestId = useRef(0)
  const activeController = useRef<AbortController | null>(null)
  const normalizerRef = useRef(normalizeSearch)
  normalizerRef.current = normalizeSearch
  const rawSearchRef = useRef('')
  const forceNormalizedRequest = useRef(false)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = normalizerRef.current ? normalizerRef.current(search) : search.trim()
      // Returning to the previously debounced term still needs a fresh request
      // when an intervening edit aborted it. Opt-in keeps other lookup behavior.
      if (normalizerRef.current && next === debouncedSearch && forceNormalizedRequest.current) setRetryCount(value => value + 1)
      setDebouncedSearch(next)
    }, debounceMs)
    return () => window.clearTimeout(timeout)
  }, [debounceMs, search])

  useEffect(() => {
    forceNormalizedRequest.current = false
    const currentRequest = ++requestId.current
    const controller = new AbortController()
    activeController.current = controller
    setStatus('loading')

    loaderRef.current(debouncedSearch, controller.signal)
      .then((results) => {
        if (controller.signal.aborted || currentRequest !== requestId.current) return
        setOptions(results)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || currentRequest !== requestId.current || isAbortError(error)) return
        setStatus('error')
      })

    return () => {
      controller.abort()
      if (activeController.current === controller) activeController.current = null
    }
  }, [debouncedSearch, retryCount])

  const retry = useCallback(() => setRetryCount((value) => value + 1), [])

  const updateSearch = useCallback((value: string) => {
    const normalize = normalizerRef.current
    if (normalize && normalize(value) === normalize(rawSearchRef.current)) {
      rawSearchRef.current = value
      setSearch(value)
      return
    }
    rawSearchRef.current = value
    forceNormalizedRequest.current = Boolean(normalize)
    activeController.current?.abort()
    activeController.current = null
    requestId.current += 1
    setStatus('loading')
    setOptions([])
    setSearch(value)
  }, [])

  return { search, setSearch: updateSearch, options, status, retry }
}
