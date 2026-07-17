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

export async function moveThread(threadId, bucketId, reason) {
  const body = { bucket_id: bucketId }
  if (reason !== undefined) body.reason = reason
  const res = await apiFetch(apiUrl(`/inbox/threads/${encodeURIComponent(threadId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to move thread')
  return data
}

export async function getJob(jobId) {
  const res = await apiFetch(apiUrl(`/inbox/jobs/${encodeURIComponent(jobId)}`), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load job')
  return data
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForJob = async (jobId, onProgress) => {
  while (true) {
    const job = await getJob(jobId)
    if (onProgress) onProgress({ done: job.done ?? 0, total: job.total ?? 0 })
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

/** Start classify job and poll GET /jobs/:id. Keeps callback API for useInbox. */
export function classifyWithProgress(onProgress, onDone, onError, options = {}) {
  const forceRefresh = options.forceRefresh !== false

  ;(async () => {
    try {
      const res = await apiFetch(apiUrl('/inbox/classify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceRefresh }),
      })
      const data = await parseJson(res).catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.error || res.statusText)
        err.status = res.status
        throw err
      }
      if (!data.jobId) throw new Error('Missing jobId from classify')

      const result = await waitForJob(data.jobId, onProgress)
      let threads = result.threads
      let classifications = result.classifications
      if (!threads) {
        const loaded = await getThreads()
        threads = loaded.threads
        classifications = loaded.classifications ?? classifications
      }
      if (onDone) onDone({ threads, classifications, type: 'done' })
    } catch (err) {
      if (onError) onError(err.message, err.status)
    }
  })()
}

export async function recategorize() {
  const res = await apiFetch(apiUrl('/inbox/recategorize'), { method: 'POST', ...defaultFetchOpts })
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Recategorization failed')
  if (!data.jobId) throw new Error('Missing jobId from recategorize')
  return waitForJob(data.jobId)
}
