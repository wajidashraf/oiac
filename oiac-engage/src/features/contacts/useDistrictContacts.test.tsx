import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getDistrictContacts, getLoggedInUserDistrict } from './contactService'
import type { ContactPage } from './contactTypes'
import { useDistrictContacts } from './useDistrictContacts'

vi.mock('./contactService', () => ({
  getLoggedInUserDistrict: vi.fn(),
  getDistrictContacts: vi.fn(),
}))

const getLoggedInUserDistrictMock = vi.mocked(getLoggedInUserDistrict)
const getDistrictContactsMock = vi.mocked(getDistrictContacts)
const CONTACT_ID = '20f9c936-6740-451e-9470-28a3c83c9909'
const DISTRICT_ID = '367d7420-d8a2-f111-b8da-7ced8d70f293'

const firstPage: ContactPage = {
  contacts: [{
    id: '10000000-0000-0000-0000-000000000001',
    fullName: 'Sara Rahimi',
    email: 'sara@example.org',
    mobilePhone: '202-555-0100',
    city: 'Washington',
    districtName: 'District 1',
    districtId: DISTRICT_ID,
  }],
  hasNext: true,
  nextLink: '/_api/contacts?%24skiptoken=opaque-page-2',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useDistrictContacts', () => {
  beforeEach(() => {
    vi.useRealTimers()
    getLoggedInUserDistrictMock.mockReset()
    getDistrictContactsMock.mockReset()
    getLoggedInUserDistrictMock.mockResolvedValue(DISTRICT_ID)
    getDistrictContactsMock.mockResolvedValue(firstPage)
  })

  test('does not request contacts until the signed-in user district is known', async () => {
    const district = deferred<string | null>()
    getLoggedInUserDistrictMock.mockReturnValue(district.promise)
    const { result } = renderHook(() => useDistrictContacts(CONTACT_ID))

    expect(result.current.status).toBe('loading-district')
    expect(getDistrictContactsMock).not.toHaveBeenCalled()

    await act(async () => district.resolve(DISTRICT_ID))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getDistrictContactsMock).toHaveBeenCalledWith(
      { districtId: DISTRICT_ID, search: '', nextLink: null },
      expect.any(AbortSignal),
    )
  })

  test('handles a missing session Contact and a Contact without a district', async () => {
    const missingSession = renderHook(() => useDistrictContacts(undefined))
    expect(missingSession.result.current.status).toBe('missing-session')
    expect(getLoggedInUserDistrictMock).not.toHaveBeenCalled()
    missingSession.unmount()

    getLoggedInUserDistrictMock.mockResolvedValue(null)
    const missingDistrict = renderHook(() => useDistrictContacts(CONTACT_ID))
    await waitFor(() => expect(missingDistrict.result.current.status).toBe('missing-district'))
    expect(getDistrictContactsMock).not.toHaveBeenCalled()
  })

  test('debounces search, sends only the latest value, and resets pagination to page one', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDistrictContacts(CONTACT_ID))
    await act(async () => Promise.resolve())
    await act(async () => Promise.resolve())

    act(() => result.current.nextPage())
    await act(async () => Promise.resolve())
    expect(result.current.page).toBe(2)

    act(() => {
      result.current.setSearch('Sar')
      result.current.setSearch('Sara')
    })
    await act(async () => vi.advanceTimersByTimeAsync(349))
    expect(getDistrictContactsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Sara' }),
      expect.anything(),
    )

    await act(async () => vi.advanceTimersByTimeAsync(1))
    await act(async () => Promise.resolve())

    expect(result.current.page).toBe(1)
    expect(getDistrictContactsMock).toHaveBeenLastCalledWith(
      { districtId: DISTRICT_ID, search: 'Sara', nextLink: null },
      expect.any(AbortSignal),
    )
  })

  test('uses server continuation cursors and never navigates below page one', async () => {
    const { result } = renderHook(() => useDistrictContacts(CONTACT_ID))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.previousPage())
    expect(result.current.page).toBe(1)

    act(() => result.current.nextPage())
    await waitFor(() => expect(result.current.page).toBe(2))
    expect(getDistrictContactsMock).toHaveBeenLastCalledWith(
      { districtId: DISTRICT_ID, search: '', nextLink: firstPage.nextLink },
      expect.any(AbortSignal),
    )

    act(() => result.current.previousPage())
    await waitFor(() => expect(result.current.page).toBe(1))
  })

  test('aborts a superseded request and ignores its late response', async () => {
    const pageOne = deferred<typeof firstPage>()
    const pageTwo = deferred<typeof firstPage>()
    getDistrictContactsMock
      .mockReturnValueOnce(pageOne.promise)
      .mockReturnValueOnce(pageTwo.promise)
    const { result } = renderHook(() => useDistrictContacts(CONTACT_ID))

    await waitFor(() => expect(getDistrictContactsMock).toHaveBeenCalledTimes(1))
    const firstSignal = getDistrictContactsMock.mock.calls[0][1]
    act(() => result.current.retry())
    await waitFor(() => expect(getDistrictContactsMock).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)

    await act(async () => pageTwo.resolve({
      contacts: [{ ...firstPage.contacts[0], fullName: 'Newest result' }],
      hasNext: false,
      nextLink: null,
    }))
    await waitFor(() => expect(result.current.contacts[0]?.fullName).toBe('Newest result'))

    await act(async () => pageOne.resolve(firstPage))
    expect(result.current.contacts[0]?.fullName).toBe('Newest result')
  })

  test('does not show aborted requests as errors and retries failed requests once requested', async () => {
    const aborted = new DOMException('Aborted', 'AbortError')
    getDistrictContactsMock
      .mockRejectedValueOnce(aborted)
      .mockRejectedValueOnce(new Error('Dataverse detail'))
      .mockResolvedValueOnce(firstPage)
    const { result } = renderHook(() => useDistrictContacts(CONTACT_ID))

    await waitFor(() => expect(getDistrictContactsMock).toHaveBeenCalledTimes(1))
    expect(result.current.status).not.toBe('error')

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toBe('Contacts could not be loaded. Try again.')

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getDistrictContactsMock).toHaveBeenCalledTimes(3)
  })
})
