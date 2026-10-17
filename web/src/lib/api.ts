import { auth } from './firebase'
import { toast } from './toast'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const FRIENDLY: Record<number, string> = {
  401: 'Please sign in again.',
  403: 'You do not have access to that.',
  413: 'That file is too large.',
  429: 'Too many requests, please wait a moment.',
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Fetch JSON from the API with the Firebase ID token. Shows a toast on failure unless quiet. */
export async function api<T>(path: string, init: RequestInit & { quiet?: boolean } = {}): Promise<T> {
  const { quiet, ...rest } = init
  const headers: Record<string, string> = { ...(await authHeader()), ...(rest.headers as Record<string, string>) }
  if (rest.body && !(rest.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { ...rest, headers })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = typeof j.detail === 'string' ? j.detail : ''
    } catch { /* non-JSON error body */ }
    const msg = detail || FRIENDLY[res.status] || (res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.')
    if (!quiet) toast(msg, 'error')
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

/** Fetch an authenticated image as an object URL (media is never public). */
export async function fetchImage(path: string): Promise<string> {
  const res = await fetch(path, { headers: await authHeader() })
  if (!res.ok) throw new ApiError(res.status, 'image unavailable')
  return URL.createObjectURL(await res.blob())
}

/** Fetch an authenticated text resource (evidence pack HTML or Markdown). */
export async function apiText(path: string): Promise<string> {
  const res = await fetch(path, { headers: await authHeader() })
  if (!res.ok) {
    toast('Could not load that document.', 'error')
    throw new ApiError(res.status, 'document unavailable')
  }
  return res.text()
}
