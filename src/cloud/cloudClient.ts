/**
 * Thin HTTP client for Supabase Edge Functions.
 *
 * Every request carries the Clerk session token in the Authorization header.
 * The Edge Functions verify the Clerk JWT server-side and derive the user id
 * from it, so the client never sends a user id explicitly.
 */

export type GetTokenFn = () => Promise<string | null>

export interface CloudClientConfig {
  /** Base URL of the deployed Edge Functions, e.g. https://<project>.supabase.co/functions/v1 */
  readonly functionsBaseUrl: string
  /** Returns the current Clerk session token (typically `useAuth().getToken`). */
  readonly getToken: GetTokenFn
}

export interface CloudClient {
  readonly request: <T>(method: HttpMethod, path: string, body?: unknown) => Promise<T>
}

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export class CloudApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'CloudApiError'
    this.status = status
  }
}

export class CloudAuthError extends Error {
  constructor(message = 'You must be signed in to use cloud features.') {
    super(message)
    this.name = 'CloudAuthError'
  }
}

const DEFAULT_TIMEOUT_MS = 20_000

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
    ) {
      return (payload as { error: string }).error
    }
  } catch {
    // Body was not JSON; fall through to the generic message.
  }
  return `Cloud request failed with status ${response.status}`
}

async function executeRequest<T>(
  config: CloudClientConfig,
  method: HttpMethod,
  path: string,
  body: unknown,
): Promise<T> {
  const token = await config.getToken()
  if (!token) {
    throw new CloudAuthError()
  }

  const baseUrl = config.functionsBaseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${baseUrl}${normalizedPath}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CloudApiError(0, 'Cloud request timed out. Check your connection and try again.')
    }
    throw new CloudApiError(0, 'Could not reach the cloud service. Check your connection and try again.')
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    if (response.status === 401) {
      throw new CloudAuthError(message)
    }
    throw new CloudApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function createCloudClient(config: CloudClientConfig): CloudClient {
  return {
    request: <T>(method: HttpMethod, path: string, body?: unknown) =>
      executeRequest<T>(config, method, path, body),
  }
}

/**
 * Builds a client from the `VITE_SUPABASE_URL` env var.
 * Throws at creation time (not request time) when the URL is missing so
 * misconfiguration surfaces early.
 */
export function createDefaultCloudClient(getToken: GetTokenFn): CloudClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not configured; cloud features are unavailable.')
  }
  return createCloudClient({
    functionsBaseUrl: `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`,
    getToken,
  })
}
