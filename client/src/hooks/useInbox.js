import { useCallback, useEffect, useState } from 'react'
import {
  getBucketsWithCounts,
  getThreads,
  classifyWithProgress,
  recategorize,
  createBucket,
  deleteBucket,
  disconnect,
  deleteAllMyData,
  moveThread,
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
  const [panel, setPanel] = useState(null)
  const [classifyComplete, setClassifyComplete] = useState(false)
  const [removingBucketId, setRemovingBucketId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [lastSortedAt, setLastSortedAt] = useState(null)
  const [movingThreadId, setMovingThreadId] = useState(null)

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
    } catch (err) {
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    }
  }, [onDisconnect])

  const loadThreads = useCallback(async (bucketId = selectedBucketId) => {
    if (!bucketId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getThreads(bucketId)
      setThreads(data.threads || [])
      setNeedClassify(!!data.needClassify)
    } catch (err) {
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onDisconnect, selectedBucketId])

  useEffect(() => {
    loadBuckets()
  }, [loadBuckets])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  const refreshBucketView = useCallback(async (bucketId) => {
    await loadBuckets()
    if (bucketId) await loadThreads(bucketId)
  }, [loadBuckets, loadThreads])

  const handleFetchAndClassify = useCallback(() => {
    setClassifying(true)
    setProgress({ done: 0, total: 200 })
    setError(null)
    setPanel(null)

    classifyWithProgress(
      (payload) => {
        setProgress({ done: payload.done ?? 0, total: payload.total ?? 200 })
        refreshBucketView('important')
      },
      () => {
        setNeedClassify(false)
        setSelectedBucketId('important')
        setClassifyComplete(true)
        setTimeout(() => setClassifyComplete(false), 4000)
        refreshBucketView('important').finally(() => setClassifying(false))
      },
      (message, status) => {
        if (status === 401) onDisconnect()
        else setError(message || 'Classification failed')
        setClassifying(false)
      },
      { forceRefresh: true }
    )
  }, [onDisconnect, refreshBucketView])

  const handleRecategorize = useCallback(async () => {
    setClassifying(true)
    setError(null)
    setPanel(null)
    try {
      await recategorize()
      setSelectedBucketId('important')
      await refreshBucketView('important')
    } catch (err) {
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setClassifying(false)
    }
  }, [onDisconnect, refreshBucketView])

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
      await handleRecategorize()
    } catch (err) {
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setCreatingBucket(false)
    }
  }, [handleRecategorize, newBucketName, onDisconnect])

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect()
      onDisconnect()
    } catch (err) {
      setError(err.message)
    }
  }, [onDisconnect])

  const handleDeleteAllData = useCallback(async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    setDeletingData(true)
    setError(null)
    try {
      await deleteAllMyData()
      onDisconnect()
    } catch (err) {
      setError(err.message)
      setDeletingData(false)
    }
  }, [onDisconnect, showDeleteConfirm])

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
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setRemovingBucketId(null)
    }
  }, [onDisconnect, refreshBucketView, selectedBucketId])

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
      await refreshBucketView(selectedBucketId)
    } catch (err) {
      setThreads(previousThreads)
      setCounts(previousCounts)
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setMovingThreadId(null)
    }
  }, [counts, onDisconnect, refreshBucketView, selectedBucketId, threads])

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
