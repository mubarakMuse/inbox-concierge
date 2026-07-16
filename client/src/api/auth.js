import { apiFetch, apiUrl, defaultFetchOpts, parseJson } from './client.js'

export async function getAuthUrl() {
  const res = await apiFetch(apiUrl('/auth/url'))
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Failed to get auth URL')
  return data.url
}

export async function getAuthStatus() {
  const res = await apiFetch(apiUrl('/auth/status'), defaultFetchOpts)
  return parseJson(res)
}

export async function disconnect() {
  const res = await apiFetch(apiUrl('/auth/disconnect'), { method: 'POST', ...defaultFetchOpts })
  if (!res.ok) throw new Error('Failed to disconnect')
}

export async function deleteAllMyData() {
  const res = await apiFetch(apiUrl('/auth/delete-all-data'), { method: 'POST', ...defaultFetchOpts })
  const data = await parseJson(res).catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to delete data')
  return data
}
