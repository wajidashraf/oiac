type PowerPagesDeferred<T> = {
  done(callback: (value: T) => void): PowerPagesDeferred<T>
  fail(callback: (error?: unknown) => void): PowerPagesDeferred<T>
}

type PowerPagesShell = {
  getTokenDeferred?: () => PowerPagesDeferred<string>
}

type PowerPagesWindow = Window & {
  shell?: PowerPagesShell
}

export type PowerPagesRequestOptions = Omit<RequestInit, 'headers'> & {
  readonly headers?: HeadersInit
}

export class PowerPagesApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'PowerPagesApiError'
    this.status = status
  }

  static async fromResponse(response: Response): Promise<PowerPagesApiError> {
    await response.text().catch(() => undefined)
    return new PowerPagesApiError('The Contacts request could not be completed.', response.status)
  }
}

function getRequestVerificationToken(): Promise<string> {
  const tokenProvider = (window as PowerPagesWindow).shell?.getTokenDeferred

  if (typeof tokenProvider !== 'function') {
    return Promise.reject(new PowerPagesApiError(
      'The secure Power Pages session is unavailable. Refresh the page and try again.',
    ))
  }

  return new Promise((resolve, reject) => {
    try {
      tokenProvider()
        .done((token) => {
          const normalizedToken = typeof token === 'string' ? token.trim() : ''
          if (normalizedToken) {
            resolve(normalizedToken)
            return
          }
          reject(new PowerPagesApiError(
            'The secure Power Pages session could not be verified. Refresh the page and try again.',
          ))
        })
        .fail(() => reject(new PowerPagesApiError(
          'The secure Power Pages session could not be verified. Refresh the page and try again.',
        )))
    } catch {
      reject(new PowerPagesApiError(
        'The secure Power Pages session could not be verified. Refresh the page and try again.',
      ))
    }
  })
}

export async function powerPagesFetch<T>(
  path: string,
  options: PowerPagesRequestOptions = {},
): Promise<T> {
  const token = await getRequestVerificationToken()
  const { headers: suppliedHeaders, ...requestOptions } = options
  const headers: Record<string, string> = {
    Accept: 'application/json',
    __RequestVerificationToken: token,
  }

  if (suppliedHeaders) {
    new Headers(suppliedHeaders).forEach((value, key) => {
      headers[key] = value
    })
  }

  const response = await fetch(path, {
    ...requestOptions,
    credentials: 'same-origin',
    headers,
  })

  if (!response.ok) {
    throw await PowerPagesApiError.fromResponse(response)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
