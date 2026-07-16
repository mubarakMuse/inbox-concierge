const API_BASE = import.meta.env.VITE_API_BASE
  ? `${String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')}/api`
  : '/api'

const UNREACHABLE_API_MESSAGE =
  'Cannot reach API. Is the server running on port 5001?'

export const defaultFetchOpts = { credentials: 'include' }

export const apiUrl = (path) => `${API_BASE}${path}`

const isFailedToFetch = (err) =>
  err instanceof TypeError && /failed to fetch/i.test(err.message || '')

export async function apiFetch(input, init) {
  try {
    return await fetch(input, init)
  } catch (err) {
    if (isFailedToFetch(err)) {
      throw new Error(UNREACHABLE_API_MESSAGE)
    }
    throw err
  }
}

export async function parseJson(res) {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    if (text.trim().startsWith('<!')) {
      throw new Error(
        'API returned a page instead of JSON. Set VITE_API_BASE to your App Runner URL and redeploy the CloudFront SPA.'
      )
    }
    throw new Error(
        text.trim() ||
          'Invalid API response — is the backend running? Start it with: cd server && npm run dev'
      )
  }
  return res.json()
}

export function throwApiError(res, data, fallback) {
  const e = new Error(data?.error || fallback)
  e.status = res.status
  throw e
}
