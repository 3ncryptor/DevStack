import type { ApiErrorBody, ApiSuccessBody } from './envelope'

/** An error response of the API, or a body that is not the envelope. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export interface ApiClientOptions {
  /** e.g. '/api' through the development proxy, or the API's URL in production. */
  baseUrl: string
  /** 'include' sends cookies to a split-origin API (auth). */
  credentials?: RequestCredentials
  fetch?: typeof fetch
}

const isErrorBody = (body: unknown): body is ApiErrorBody =>
  typeof body === 'object' && body !== null && (body as { success?: unknown }).success === false

const isSuccessBody = <T>(body: unknown): body is ApiSuccessBody<T> =>
  typeof body === 'object' && body !== null && (body as { success?: unknown }).success === true

/** A small typed fetch wrapper: resolves the base URL and turns the error envelope into errors. */
export function createApiClient(options: ApiClientOptions) {
  const send = options.fetch ?? fetch

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiSuccessBody<T>> {
    const response = await send(`${options.baseUrl}${path}`, {
      method,
      credentials: options.credentials,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const payload: unknown = await response.json().catch(() => undefined)
    if (isErrorBody(payload)) {
      const { code, message, requestId, details } = payload.error
      throw new ApiClientError(response.status, code, message, requestId, details)
    }
    if (!response.ok || !isSuccessBody<T>(payload)) {
      throw new ApiClientError(response.status, 'BAD_RESPONSE', `Unexpected response from ${path}`)
    }
    return payload
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path)
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
