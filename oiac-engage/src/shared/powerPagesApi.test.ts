import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PowerPagesApiError, powerPagesFetch, powerPagesRequest } from './powerPagesApi'

type Deferred<T> = {
  done(callback: (value: T) => void): Deferred<T>
  fail(callback: (error?: unknown) => void): Deferred<T>
}

function resolvedDeferred<T>(value: T): Deferred<T> {
  return {
    done(callback) {
      callback(value)
      return this
    },
    fail() {
      return this
    },
  }
}

function rejectedDeferred(error: unknown): Deferred<string> {
  return {
    done() {
      return this
    },
    fail(callback) {
      callback(error)
      return this
    },
  }
}

function setShellToken(deferred: Deferred<string>) {
  Object.assign(window, {
    shell: {
      getTokenDeferred: vi.fn(() => deferred),
    },
  })
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
    delete (window as Window & { shell?: unknown }).shell
  })

  test('adds the portal CSRF token and forwards request cancellation', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 'district contacts' }))
    vi.stubGlobal('fetch', fetchMock)
    setShellToken(resolvedDeferred('csrf-token'))

    const result = await powerPagesFetch<{ value: string }>('/_api/contacts', {
      signal: controller.signal,
    })

    expect(result).toEqual({ value: 'district contacts' })
    expect(fetchMock).toHaveBeenCalledWith('/_api/contacts', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        __RequestVerificationToken: 'csrf-token',
      },
      signal: controller.signal,
    })
  })

  test('exposes a successful raw response so callers can inspect entity headers', async () => {
    const response = new Response(null, {
      status: 204,
      headers: { entityid: '11111111-1111-1111-1111-111111111111' },
    })
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    setShellToken(resolvedDeferred('csrf-token'))

    const result = await powerPagesRequest('/_api/mss_meetingreports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"mss_subject":"Meeting"}',
    })

    expect(result.headers.get('entityid')).toBe('11111111-1111-1111-1111-111111111111')
    expect(fetchMock).toHaveBeenCalledWith('/_api/mss_meetingreports', {
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

  test('reports an unavailable Power Pages token provider without sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(powerPagesFetch('/_api/contacts')).rejects.toMatchObject({
      name: 'PowerPagesApiError',
      message: 'The secure Power Pages session is unavailable. Refresh the page and try again.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('reports a CSRF token failure without sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setShellToken(rejectedDeferred(new Error('token endpoint detail')))

    await expect(powerPagesFetch('/_api/contacts')).rejects.toMatchObject({
      name: 'PowerPagesApiError',
      message: 'The secure Power Pages session could not be verified. Refresh the page and try again.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('converts failed responses to a non-sensitive typed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(
      { error: { message: 'Sensitive Dataverse implementation detail' } },
      { ok: false, status: 403 },
    )))
    setShellToken(resolvedDeferred('csrf-token'))

    const request = powerPagesFetch('/_api/contacts')

    await expect(request).rejects.toBeInstanceOf(PowerPagesApiError)
    await expect(request).rejects.toMatchObject({
      status: 403,
      message: 'The Contacts request could not be completed.',
    })
  })

  test('returns undefined for an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: vi.fn(),
      text: vi.fn(),
    } as unknown as Response))
    setShellToken(resolvedDeferred('csrf-token'))

    await expect(powerPagesFetch<void>('/_api/contacts')).resolves.toBeUndefined()
  })
})
