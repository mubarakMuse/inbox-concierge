import { apiFetch, apiUrl, defaultFetchOpts, parseJson, throwApiError } from './client.js'

const JOB_POLL_MS = 800
const ACTIVE_JOB_STORAGE_KEY = 'inbox:activeJobId'

let activePollController = null

export const getStoredActiveJobId = () => {
  try {
    return sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)
  } catch {
    return null
  }
}

export const setStoredActiveJobId = (jobId) => {
  try {
    if (jobId) sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId)
    else sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const clearStoredActiveJobId = () => setStoredActiveJobId(null)

/** Cancel in-flight client poll loop (does not cancel server job by itself). */
export const cancelActiveJobPoll = () => {
  if (!activePollController) return
  activePollController.abort()
  activePollController = null
}

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

export async function getActiveJob() {
  const res = await apiFetch(apiUrl('/inbox/jobs/active'), defaultFetchOpts)
  const data = await parseJson(res)
  if (!res.ok) throwApiError(res, data, 'Failed to load active job')
  return data
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('Cancelled')
      err.name = 'AbortError'
      reject(err)
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      const err = new Error('Cancelled')
      err.name = 'AbortError'
      reject(err)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

export const waitForJob = async (jobId, onProgress, signal) => {
  while (true) {
    if (signal?.aborted) {
      const err = new Error('Cancelled')
      err.name = 'AbortError'
      throw err
    }
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
      const err = new Error(job.error || 'Job failed')
      if (job.error === 'Cancelled') err.name = 'AbortError'
      throw err
    }
    await sleep(JOB_POLL_MS, signal)
  }
}

const beginPoll = () => {
  cancelActiveJobPoll()
  activePollController = new AbortController()
  return activePollController.signal
}

const finishPoll = (jobId) => {
  if (activePollController) activePollController = null
  if (jobId) clearStoredActiveJobId()
}

/** Start classify job and poll GET /jobs/:id. Keeps callback API for useInbox. */
export function classifyWithProgress(onProgress, onDone, onError, options = {}) {
  const forceRefresh = options.forceRefresh !== false
  const signal = beginPoll()

  ;(async () => {
    let jobId = null
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
      jobId = data.jobId
      setStoredActiveJobId(jobId)

      const result = await waitForJob(jobId, onProgress, signal)
      let threads = result.threads
      let classifications = result.classifications
      if (!threads) {
        const loaded = await getThreads()
        threads = loaded.threads
        classifications = loaded.classifications ?? classifications
      }
      finishPoll(jobId)
      if (onDone) onDone({ threads, classifications, type: 'done' })
    } catch (err) {
      finishPoll(jobId)
      if (err?.name === 'AbortError') {
        if (onError) onError('Cancelled', 0, { cancelled: true })
        return
      }
      if (onError) onError(err.message, err.status)
    }
  })()
}

/** Resume polling an existing job (e.g. after page refresh). */
export function resumeJobWithProgress(jobId, onProgress, onDone, onError) {
  if (!jobId) {
    if (onError) onError('Missing jobId')
    return
  }
  const signal = beginPoll()
  setStoredActiveJobId(jobId)

  ;(async () => {
    try {
      const result = await waitForJob(jobId, onProgress, signal)
      let threads = result.threads
      let classifications = result.classifications
      if (!threads) {
        const loaded = await getThreads()
        threads = loaded.threads
        classifications = loaded.classifications ?? classifications
      }
      finishPoll(jobId)
      if (onDone) onDone({ threads, classifications, type: 'done' })
    } catch (err) {
      finishPoll(jobId)
      if (err?.name === 'AbortError') {
        if (onError) onError('Cancelled', 0, { cancelled: true })
        return
      }
      if (onError) onError(err.message, err.status)
    }
  })()
}

export async function recategorize(onProgress) {
  const signal = beginPoll()
  let jobId = null
  try {
    const res = await apiFetch(apiUrl('/inbox/recategorize'), { method: 'POST', ...defaultFetchOpts })
    const data = await parseJson(res)
    if (!res.ok) throwApiError(res, data, 'Recategorization failed')
    if (!data.jobId) throw new Error('Missing jobId from recategorize')
    jobId = data.jobId
    setStoredActiveJobId(jobId)
    const result = await waitForJob(jobId, onProgress, signal)
    finishPoll(jobId)
    return result
  } catch (err) {
    finishPoll(jobId)
    throw err
  }
}
