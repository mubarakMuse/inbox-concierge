import { apiUrl, defaultFetchOpts, parseJson, throwApiError } from './client.js'

export async function getBucketsWithCounts() {
  const res = await fetch(apiUrl('/inbox/buckets'), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load buckets')
  return data
}

export async function getThreads(bucketId) {
  const path = bucketId
    ? `/inbox/threads?bucket_id=${encodeURIComponent(bucketId)}`
    : '/inbox/threads'
  const res = await fetch(apiUrl(path), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load threads')
  return data
}

export function classifyWithProgress(onProgress, onDone, onError) {
  fetch(apiUrl('/inbox/classify-progress'), {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await parseJson(res).catch(() => ({}))
        const err = new Error(data.error || res.statusText)
        err.status = res.status
        throw err
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (onDone) onDone()
            return
          }
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const payload = JSON.parse(line.slice(6))
              if (payload.type === 'progress' && onProgress) onProgress(payload)
              if (payload.type === 'done' && onDone) onDone(payload)
              if (payload.type === 'error' && onError) onError(payload.error)
            } catch {
              /* ignore malformed SSE line */
            }
          }
          read()
        })
      }
      read()
    })
    .catch((err) => {
      if (onError) onError(err.message, err.status)
    })
}

export async function recategorize() {
  const res = await fetch(apiUrl('/inbox/recategorize'), { method: 'POST', ...defaultFetchOpts })
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Recategorization failed')
  return data
}
