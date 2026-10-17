// Shared helpers: JSON responses, CORS, caching, validation errors.

export const FIRST_YEAR = 1880
export const LAST_YEAR = 2025
export const DOCS_URL = 'https://github.com/moisesvasquez/us-baby-names/blob/main/docs/API.md'

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // The data only changes once a year, so let the CDN cache aggressively.
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

export function error(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message, docs: DOCS_URL } }), {
    status,
    headers: { ...headers, 'Cache-Control': 'no-store' },
  })
}

/** Wrap a handler with CORS preflight, method check and uniform error handling. */
export function handler(fn: (url: URL, req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'GET') return error(405, 'method_not_allowed', 'Only GET is supported.')
    try {
      return await fn(new URL(req.url), req)
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.code, e.message)
      console.error(e)
      return error(500, 'internal_error', 'Something went wrong. Please try again later.')
    }
  }
}

export type Sex = 'F' | 'M'

/** sex query param: F, M, or omitted/"all" for both. */
export function parseSex(v: string | null, allowAll = true): Sex | null {
  if (v == null || v === '' || (allowAll && v.toLowerCase() === 'all')) {
    if (!allowAll) throw new HttpError(400, 'invalid_sex', 'sex is required and must be F or M.')
    return null
  }
  const s = v.toUpperCase()
  if (s === 'F' || s === 'M') return s
  throw new HttpError(400, 'invalid_sex', allowAll ? 'sex must be F, M or all.' : 'sex must be F or M.')
}

export function parseInt0(v: string | null, name: string, min: number, max: number, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `invalid_${name}`, `${name} must be an integer between ${min} and ${max}.`)
  }
  return n
}

const NAME_RE = /^[A-Za-z]{1,15}$/
export function parseName(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  if (!NAME_RE.test(s)) throw new HttpError(400, 'invalid_name', 'Names are 1–15 letters A–Z (no spaces, accents or hyphens, as in the SSA data).')
  return s
}

/** Last path segment, decoded: /api/names/Mary -> "Mary" */
export function lastSegment(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/\/+$/, '').split('/').pop() ?? '')
}
