import { apiUrl, defaultFetchOpts, parseJson } from './client.js'

export async function createBucket(name) {
  const res = await fetch(apiUrl('/buckets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    ...defaultFetchOpts,
  })
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Failed to create bucket')
  return data
}

export async function deleteBucket(id) {
  const res = await fetch(apiUrl(`/buckets/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    ...defaultFetchOpts,
  })
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Failed to remove bucket')
  return data
}
