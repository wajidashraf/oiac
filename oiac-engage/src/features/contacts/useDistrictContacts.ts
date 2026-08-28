import { useCallback, useEffect, useRef, useState } from 'react'
import { getDistrictContacts, getLoggedInUserDistrict } from './contactService'
import type { DistrictContact } from './contactTypes'

export type DistrictContactsStatus =
  | 'loading-district'
  | 'loading-contacts'
  | 'ready'
  | 'missing-session'
  | 'missing-district'
  | 'error'

export type DistrictContactsState = {
  readonly contacts: readonly DistrictContact[]
  readonly search: string
  readonly setSearch: (value: string) => void
  readonly page: number
  readonly hasNext: boolean
  readonly isLoading: boolean
  readonly status: DistrictContactsStatus
  readonly errorMessage: string | null
  readonly nextPage: () => void
  readonly previousPage: () => void
  readonly retry: () => void
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export function useDistrictContacts(contactId?: string): DistrictContactsState {
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<readonly DistrictContact[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [status, setStatus] = useState<DistrictContactsStatus>(
    contactId ? 'loading-district' : 'missing-session',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [districtRetry, setDistrictRetry] = useState(0)
  const [contactsRetry, setContactsRetry] = useState(0)
  const districtRequestId = useRef(0)
  const contactsRequestId = useRef(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1)
      setDebouncedSearch(search.trim())
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    const requestId = ++districtRequestId.current
    const controller = new AbortController()

    setDistrictId(null)
    setContacts([])
    setHasNext(false)
    setPage(1)
    setErrorMessage(null)

    if (!contactId) {
      setStatus('missing-session')
      return () => controller.abort()
    }

    setStatus('loading-district')
    getLoggedInUserDistrict(contactId, controller.signal)
      .then((resolvedDistrictId) => {
        if (controller.signal.aborted || requestId !== districtRequestId.current) return
        if (!resolvedDistrictId) {
          setStatus('missing-district')
          return
        }
        setDistrictId(resolvedDistrictId)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== districtRequestId.current || isAbortError(error)) return
        console.error('[DistrictContacts] district request failed', {
          error,
          contactId,
          requestId,
          signalAborted: controller.signal.aborted,
        })
        setStatus('error')
        setErrorMessage('Your district could not be loaded. Try again.')
      })

    return () => controller.abort()
  }, [contactId, districtRetry])

  useEffect(() => {
    if (!districtId) return undefined

    const requestId = ++contactsRequestId.current
    const controller = new AbortController()
    setStatus('loading-contacts')
    setErrorMessage(null)

    getDistrictContacts(
      { districtId, page, search: debouncedSearch },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted || requestId !== contactsRequestId.current) return
        setContacts(result.contacts)
        setHasNext(result.hasNext)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== contactsRequestId.current || isAbortError(error)) return
        console.error('[DistrictContacts] Contacts request failed', {
          error,
          districtId,
          page,
          searchLength: debouncedSearch.length,
          requestId,
          signalAborted: controller.signal.aborted,
        })
        setStatus('error')
        setErrorMessage('Contacts could not be loaded. Try again.')
      })

    return () => controller.abort()
  }, [contactsRetry, debouncedSearch, districtId, page])

  const nextPage = useCallback(() => setPage((currentPage) => currentPage + 1), [])
  const previousPage = useCallback(() => setPage((currentPage) => Math.max(1, currentPage - 1)), [])
  const retry = useCallback(() => {
    if (districtId) {
      setContactsRetry((value) => value + 1)
      return
    }
    setDistrictRetry((value) => value + 1)
  }, [districtId])

  return {
    contacts,
    search,
    setSearch,
    page,
    hasNext,
    isLoading: status === 'loading-district' || status === 'loading-contacts',
    status,
    errorMessage,
    nextPage,
    previousPage,
    retry,
  }
}
