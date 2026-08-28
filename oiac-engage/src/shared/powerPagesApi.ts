export type PowerPagesRequestOptions = Omit<RequestInit, 'headers'> & {
  readonly headers?: HeadersInit
}

let cachedRequestVerificationToken: string | null = null
let requestVerificationTokenPromise: Promise<string> | null = null

export class PowerPagesApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly diagnosticMessage?: string

  constructor(
    message: string,
    status?: number,
    details: { readonly code?: string; readonly diagnosticMessage?: string } = {},
  ) {
    super(message)
    this.name = 'PowerPagesApiError'
    this.status = status
    this.code = details.code
    this.diagnosticMessage = details.diagnosticMessage
  }

  static async fromResponse(response: Response): Promise<PowerPagesApiError> {
    const responseText = await response.text().catch(() => '')
    let code: string | undefined
    let diagnosticMessage: string | undefined

    try {
      const body = JSON.parse(responseText) as {
        readonly error?: { readonly code?: unknown; readonly message?: unknown }
      }
      if (typeof body.error?.code === 'string') code = body.error.code
      if (typeof body.error?.message === 'string') diagnosticMessage = body.error.message.slice(0, 1000)
    } catch {
      // Power Pages can return HTML error pages. Do not echo them into application logs.
    }

    return new PowerPagesApiError(
      'The Power Pages request could not be completed.',
      response.status,
      { code, diagnosticMessage },
    )
  }
}

function normalizeRequestVerificationToken(value: unknown): string {
  if (typeof value !== 'string') return ''

  const response = value.trim()
  if (!response.includes('<')) return response

  const template = document.createElement('template')
  template.innerHTML = response
  return template.content
    .querySelector<HTMLInputElement>('input[name="__RequestVerificationToken"]')
    ?.value.trim() ?? ''
}

export function clearPowerPagesRequestVerificationToken(): void {
  cachedRequestVerificationToken = null
  requestVerificationTokenPromise = null
}

function getRequestVerificationToken(): Promise<string> {
  if (cachedRequestVerificationToken) {
    console.debug('[PowerPagesApi] using cached verification token')
    return Promise.resolve(cachedRequestVerificationToken)
  }
  if (requestVerificationTokenPromise) {
    console.debug('[PowerPagesApi] joining active verification-token request')
    return requestVerificationTokenPromise
  }

  console.debug('[PowerPagesApi] verification-token request starting', {
    path: '/_layout/tokenhtml',
  })
  requestVerificationTokenPromise = fetch('/_layout/tokenhtml', {
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  })
    .then(async (response) => {
      console.debug('[PowerPagesApi] verification-token response received', {
        status: response.status,
        contentType: response.headers?.get?.('content-type') ?? null,
      })
      if (!response.ok) throw new Error('Power Pages token endpoint failed.')
      const token = normalizeRequestVerificationToken(await response.text())
      if (!token) throw new Error('Power Pages token response was invalid.')
      cachedRequestVerificationToken = token
      console.debug('[PowerPagesApi] verification token parsed', { tokenPresent: true })
      return token
    })
    .catch((error: unknown) => {
      console.error('[PowerPagesApi] verification-token request failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      throw new PowerPagesApiError(
        'The secure Power Pages session could not be verified. Refresh the page and try again.',
      )
    })
    .finally(() => {
      requestVerificationTokenPromise = null
    })

  return requestVerificationTokenPromise
}

export async function powerPagesFetch<T>(
  path: string,
  options: PowerPagesRequestOptions = {},
): Promise<T> {
  const response = await powerPagesRequest(path, options)

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function powerPagesRequest(
  path: string,
  options: PowerPagesRequestOptions = {},
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase()
  const requiresVerificationToken = method !== 'GET' && method !== 'HEAD'
  const { headers: suppliedHeaders, ...requestOptions } = options
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  console.debug('[PowerPagesApi] request prepared', {
    method,
    path,
    requiresVerificationToken,
    signalAborted: options.signal?.aborted ?? false,
  })

  if (requiresVerificationToken) {
    headers.__RequestVerificationToken = await getRequestVerificationToken()
  }

  if (suppliedHeaders) {
    new Headers(suppliedHeaders).forEach((value, key) => {
      headers[key] = value
    })
  }

  try {
    console.debug('[PowerPagesApi] fetch starting', {
      method,
      path,
      signalAborted: options.signal?.aborted ?? false,
    })
    const response = await fetch(path, {
      ...requestOptions,
      credentials: 'same-origin',
      headers,
    })

    console.debug('[PowerPagesApi] response received', {
      method,
      path,
      status: response.status,
      contentType: response.headers?.get?.('content-type') ?? null,
    })

    if (!response.ok) {
      throw await PowerPagesApiError.fromResponse(response)
    }

    return response
  } catch (error) {
    console.error('[PowerPagesApi] request failed', {
      method,
      path,
      signalAborted: options.signal?.aborted ?? false,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStatus: error instanceof PowerPagesApiError ? error.status : undefined,
      errorCode: error instanceof PowerPagesApiError ? error.code : undefined,
      diagnosticMessage: error instanceof PowerPagesApiError ? error.diagnosticMessage : undefined,
    })
    throw error
  }
}
