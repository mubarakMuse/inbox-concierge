import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getBucketsWithCounts,
  getThreads,
  classifyWithProgress,
  resumeJobWithProgress,
  recategorize,
  createBucket,
  deleteBucket,
  disconnect,
  deleteAllMyData,
  moveThread,
  getActiveJob,
  getJob,
  cancelActiveJobPoll,
  getStoredActiveJobId,
  clearStoredActiveJobId,
} from '../api/index.js'
import { slugify } from '../utils/slugify.js'

const handleAuthError = (error, onDisconnect) => {
  if (error?.status === 401) {
    onDisconnect()
    return true
  }
  return false
}

export function useInbox(onDisconnect) {
  const [buckets, setBuckets] = useState([])
  const [counts, setCounts] = useState({})
  const [selectedBucketId, setSelectedBucketId] = useState(null)
  const [threads, setThreads] = useState([])
  const [needClassify, setNeedClassify] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [newBucketName, setNewBucketName] = useState('')
  const [creatingBucket, setCreatingBucket] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [panel, setPanel] = useState(null)
  const [classifyComplete, setClassifyComplete] = useState(false)
  const [removingBucketId, setRemovingBucketId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [lastSortedAt, setLastSortedAt] = useState(null)
  const [movingThreadId, setMovingThreadId] = useState(null)
  const classifyingRef = useRef(false)
  const resumeStartedRef = useRef(false)
  const onDisconnectRef = useRef(onDisconnect)

  useEffect(() => {
    onDisconnectRef.current = onDisconnect
  }, [onDisconnect])

  const setClassifyingState = useCallback((value) => {
    classifyingRef.current = value
    setClassifying(value)
  }, [])

  const showNotice = useCallback((message) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 4000)
  }, [])

  const loadBuckets = useCallback(async () => {
    try {
      const data = await getBucketsWithCounts()
      setBuckets(data.buckets)
      setCounts(data.counts || {})
      setLastSortedAt(data.lastSortedAt ?? null)
      setSelectedBucketId((current) => {
        if (current) return current
        const hasImportant = data.buckets?.some((b) => b.id === 'important')
        if (hasImportant) return 'important'
        return data.buckets?.[0]?.id || null
      })
      return data
    } catch (err) {
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
      return null
    }
  }, [])

  const loadThreads = useCallback(async (bucketId = selectedBucketId, options = {}) => {
    if (!bucketId) return
    const silent = options.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await getThreads(bucketId)
      setThreads(data.threads || [])
      setNeedClassify(!!data.needClassify)
    } catch (err) {
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selectedBucketId])

  const refreshBucketView = useCallback(async (bucketId, options = {}) => {
    await loadBuckets()
    if (bucketId) await loadThreads(bucketId, options)
  }, [loadBuckets, loadThreads])

  const handleClassifyProgress = useCallback((payload) => {
    setProgress({ done: payload.done ?? 0, total: payload.total ?? 200 })
    loadBuckets()
  }, [loadBuckets])

  const handleClassifyDone = useCallback(() => {
    setNeedClassify(false)
    setSelectedBucketId('important')
    setClassifyComplete(true)
    setTimeout(() => setClassifyComplete(false), 4000)
    clearStoredActiveJobId()
    refreshBucketView('important').finally(() => setClassifyingState(false))
  }, [refreshBucketView, setClassifyingState])

  const handleClassifyError = useCallback((message, status, meta) => {
    if (meta?.cancelled) {
      setClassifyingState(false)
      return
    }
    if (status === 401) onDisconnectRef.current()
    else setError(message || 'Classification failed')
    clearStoredActiveJobId()
    setClassifyingState(false)
  }, [setClassifyingState])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const data = await loadBuckets()
      if (cancelled || !data || resumeStartedRef.current) return

      try {
        let job = null
        const active = await getActiveJob()
        job = active?.job ?? null

        if (!job) {
          const storedId = getStoredActiveJobId()
          if (storedId) {
            try {
              const storedJob = await getJob(storedId)
              if (storedJob?.status === 'queued' || storedJob?.status === 'running') {
                job = storedJob
              } else {
                clearStoredActiveJobId()
              }
            } catch {
              clearStoredActiveJobId()
            }
          }
        }

        if (!job) return
        if (job.type !== 'classify' && job.type !== 'recategorize') return

        resumeStartedRef.current = true
        setClassifyingState(true)
        setProgress({ done: job.done ?? 0, total: job.total || 200 })
        setPanel(null)
        resumeJobWithProgress(
          job.id,
          handleClassifyProgress,
          handleClassifyDone,
          handleClassifyError
        )
      } catch {
        /* ignore resume failures — inbox still usable */
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [
    handleClassifyDone,
    handleClassifyError,
    handleClassifyProgress,
    loadBuckets,
    setClassifyingState,
  ])

  useEffect(() => {
    if (classifyingRef.current) return
    loadThreads()
  }, [loadThreads])

  const handleFetchAndClassify = useCallback(() => {
    setClassifyingState(true)
    setProgress({ done: 0, total: 200 })
    setError(null)
    setPanel(null)

    classifyWithProgress(
      handleClassifyProgress,
      handleClassifyDone,
      handleClassifyError,
      { forceRefresh: true }
    )
  }, [handleClassifyDone, handleClassifyError, handleClassifyProgress, setClassifyingState])

  const handleRecategorize = useCallback(async () => {
    setClassifyingState(true)
    setProgress({ done: 0, total: 200 })
    setError(null)
    setPanel(null)
    try {
      await recategorize(handleClassifyProgress)
      setSelectedBucketId('important')
      setClassifyComplete(true)
      setTimeout(() => setClassifyComplete(false), 4000)
      await refreshBucketView('important')
    } catch (err) {
      if (err?.name === 'AbortError') return
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
    } finally {
      clearStoredActiveJobId()
      setClassifyingState(false)
    }
  }, [handleClassifyProgress, refreshBucketView, setClassifyingState])

  const handleCreateBucket = useCallback(async (e) => {
    e.preventDefault()
    const name = newBucketName.trim()
    if (!name) return

    setCreatingBucket(true)
    setError(null)
    try {
      await createBucket(name)
      setNewBucketName('')
      setSelectedBucketId(slugify(name))
      await loadBuckets()
      if (classifyingRef.current) {
        showNotice('Bucket added — it will apply on next sort')
        return
      }
      await handleRecategorize()
    } catch (err) {
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
    } finally {
      setCreatingBucket(false)
    }
  }, [handleRecategorize, loadBuckets, newBucketName, showNotice])

  const handleDisconnect = useCallback(async () => {
    if (classifyingRef.current) return
    try {
      await disconnect()
      onDisconnectRef.current()
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const handleDeleteAllData = useCallback(async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    cancelActiveJobPoll()
    setClassifyingState(false)
    clearStoredActiveJobId()
    setDeletingData(true)
    setError(null)
    try {
      await deleteAllMyData()
      onDisconnectRef.current()
    } catch (err) {
      setError(err.message)
      setDeletingData(false)
    }
  }, [setClassifyingState, showDeleteConfirm])

  const handleRemoveBucket = useCallback(async (e, bucketId) => {
    e.stopPropagation()
    setRemovingBucketId(bucketId)
    setError(null)
    try {
      await deleteBucket(bucketId)
      const nextBucketId = selectedBucketId === bucketId ? 'other' : selectedBucketId
      if (selectedBucketId === bucketId) setSelectedBucketId('other')
      await refreshBucketView(nextBucketId)
    } catch (err) {
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
    } finally {
      setRemovingBucketId(null)
    }
  }, [refreshBucketView, selectedBucketId])

  const handleMoveThread = useCallback(async (threadId, bucketId) => {
    if (!threadId || !bucketId) return
    const previousThreads = threads
    const previousCounts = counts
    const fromBucketId = selectedBucketId

    setMovingThreadId(threadId)
    setError(null)

    setThreads((current) => current.filter((t) => t.id !== threadId))
    setCounts((current) => {
      const next = { ...current }
      if (fromBucketId && next[fromBucketId] !== undefined) {
        next[fromBucketId] = Math.max(0, (next[fromBucketId] || 0) - 1)
      }
      if (next[bucketId] !== undefined) {
        next[bucketId] = (next[bucketId] || 0) + 1
      } else {
        next[bucketId] = 1
      }
      return next
    })

    try {
      await moveThread(threadId, bucketId)
      await refreshBucketView(selectedBucketId, { silent: true })
    } catch (err) {
      setThreads(previousThreads)
      setCounts(previousCounts)
      if (!handleAuthError(err, onDisconnectRef.current)) setError(err.message)
    } finally {
      setMovingThreadId(null)
    }
  }, [counts, refreshBucketView, selectedBucketId, threads])

  const handleTogglePanel = useCallback((nextPanel) => {
    setPanel((current) => (current === nextPanel ? null : nextPanel))
    if (nextPanel !== 'account') setShowDeleteConfirm(false)
  }, [])

  const selectedBucket = buckets.find((b) => b.id === selectedBucketId)

  return {
    buckets,
    counts,
    selectedBucketId,
    selectedBucket,
    threads,
    needClassify,
    loading,
    classifying,
    progress,
    newBucketName,
    creatingBucket,
    error,
    notice,
    panel,
    classifyComplete,
    removingBucketId,
    showDeleteConfirm,
    deletingData,
    lastSortedAt,
    movingThreadId,
    setError,
    setNewBucketName,
    setPanel,
    setShowDeleteConfirm,
    setSelectedBucketId,
    handleFetchAndClassify,
    handleRecategorize,
    handleCreateBucket,
    handleDisconnect,
    handleDeleteAllData,
    handleRemoveBucket,
    handleMoveThread,
    handleTogglePanel,
  }
}
