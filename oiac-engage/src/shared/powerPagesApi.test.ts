import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearPowerPagesRequestVerificationToken,
  PowerPagesApiError,
  powerPagesFetch,
  powerPagesRequest,
} from './powerPagesApi'

function tokenResponse(
  token = 'csrf-token',
  init: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: vi.fn().mockResolvedValue(
      `<input name="__RequestVerificationToken" type="hidden" value="${token}" />`,
    ),
  } as unknown as Response
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response
}

describe('powerPagesFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    clearPowerPagesRequestVerificationToken()
  })

  test('sends GET requests directly without waiting for a CSRF token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 'district contacts' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await powerPagesFetch<{ value: string }>('/_api/contacts')

    expect(result).toEqual({ value: 'district contacts' })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/_api/contacts', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  test('forwards request cancellation on direct GET requests', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 'district contacts' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await powerPagesFetch<{ value: string }>('/_api/contacts', {
      signal: controller.signal,
    })

    expect(result).toEqual({ value: 'district contacts' })
    expect(fetchMock).toHaveBeenCalledWith('/_api/contacts', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  test('retrieves and extracts the CSRF token for mutations', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse('csrf_token-with-symbols'))
      .mockResolvedValueOnce(jsonResponse({ value: 'district contacts' }))
    vi.stubGlobal('fetch', fetchMock)

    await powerPagesRequest('/_api/mss_meetingreports', { method: 'POST' })

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/_api/mss_meetingreports', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        __RequestVerificationToken: 'csrf_token-with-symbols',
      },
    })
  })

  test('caches the Power Pages token across mutation requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ value: ['first'] }))
      .mockResolvedValueOnce(jsonResponse({ value: ['second'] }))
    vi.stubGlobal('fetch', fetchMock)

    await powerPagesRequest('/_api/mss_meetingreports', { method: 'POST' })
    await powerPagesRequest('/_api/mss_meetingreports(11111111-1111-1111-1111-111111111111)', {
      method: 'PATCH',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/_layout/tokenhtml', {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    })
  })

  test('exposes a successful raw response so callers can inspect entity headers', async () => {
    const response = new Response(null, {
      status: 204,
      headers: { entityid: '11111111-1111-1111-1111-111111111111' },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await powerPagesRequest('/_api/mss_meetingreports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"mss_subject":"Meeting"}',
    })

    expect(result.headers.get('entityid')).toBe('11111111-1111-1111-1111-111111111111')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/_api/mss_meetingreports', {
      method: 'POST',
      body: '{"mss_subject":"Meeting"}',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        __RequestVerificationToken: 'csrf-token',
      },
    })
  })

  test('reports a failed Power Pages token response without sending a mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('', { ok: false, status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(powerPagesRequest('/_api/mss_meetingreports', { method: 'POST' })).rejects.toMatchObject({
      name: 'PowerPagesApiError',
      message: 'The secure Power Pages session could not be verified. Refresh the page and try again.',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test('reports a CSRF token network failure without sending a mutation', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('token endpoint detail'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(powerPagesRequest('/_api/mss_meetingreports', { method: 'POST' })).rejects.toMatchObject({
      name: 'PowerPagesApiError',
      message: 'The secure Power Pages session could not be verified. Refresh the page and try again.',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test('converts failed responses to a non-sensitive typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(
      { error: { message: 'Sensitive Dataverse implementation detail' } },
      { ok: false, status: 403 },
    )))

    const request = powerPagesFetch('/_api/contacts')

    await expect(request).rejects.toBeInstanceOf(PowerPagesApiError)
    await expect(request).rejects.toMatchObject({
      status: 403,
      message: 'The Power Pages request could not be completed.',
    })
  })

  test('returns undefined for an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: vi.fn(),
      text: vi.fn(),
    } as unknown as Response))

    await expect(powerPagesFetch<void>('/_api/contacts')).resolves.toBeUndefined()
  })
})
