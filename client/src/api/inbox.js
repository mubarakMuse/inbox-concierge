import { apiFetch, apiUrl, defaultFetchOpts, parseJson, throwApiError } from './client.js'

const JOB_POLL_MS = 800

export async function getBucketsWithCounts() {
  const res = await apiFetch(apiUrl('/inbox/buckets'), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load buckets')
  return data
}

export async function getThreads(bucketId) {
  const path = bucketId
    ? `/inbox/threads?bucket_id=${encodeURIComponent(bucketId)}`
    : '/inbox/threads'
  const res = await apiFetch(apiUrl(path), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load threads')
  return data
}

export async function getJob(jobId) {
  const res = await apiFetch(apiUrl(`/inbox/jobs/${encodeURIComponent(jobId)}`), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load job')
  return data
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForJob = async (jobId) => {
  while (true) {
    const job = await getJob(jobId)
    if (job.status === 'completed') {
      return {
        jobId,
        classifications: job.result?.classifications ?? {},
        threads: job.result?.threads,
        progress: { done: job.done, total: job.total },
      }
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed')
    }
    await sleep(JOB_POLL_MS)
  }
}

export function classifyWithProgress(onProgress, onDone, onError) {
  apiFetch(apiUrl('/inbox/classify-progress'), {
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
  const res = await apiFetch(apiUrl('/inbox/recategorize'), { method: 'POST', ...defaultFetchOpts })
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Recategorization failed')
  if (!data.jobId) throw new Error('Missing jobId from recategorize')
  return waitForJob(data.jobId)
}
