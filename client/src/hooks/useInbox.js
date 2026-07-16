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
  const [manageOpen, setManageOpen] = useState(false)
  const [classifyComplete, setClassifyComplete] = useState(false)
  const [removingBucketId, setRemovingBucketId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingData, setDeletingData] = useState(false)

  const loadBuckets = useCallback(async () => {
    try {
      const data = await getBucketsWithCounts()
      setBuckets(data.buckets)
      setCounts(data.counts || {})
      setSelectedBucketId((current) => current || data.buckets?.[0]?.id || null)
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
    const bucketId = selectedBucketId
    setClassifying(true)
    setProgress({ done: 0, total: 200 })
    setError(null)

    classifyWithProgress(
      (payload) => {
        setProgress({ done: payload.done ?? 0, total: payload.total ?? 200 })
        refreshBucketView(bucketId)
      },
      () => {
        setNeedClassify(false)
        setClassifyComplete(true)
        setTimeout(() => setClassifyComplete(false), 4000)
        refreshBucketView(bucketId).finally(() => setClassifying(false))
      },
      (message, status) => {
        if (status === 401) onDisconnect()
        else setError(message || 'Classification failed')
        setClassifying(false)
      }
    )
  }, [onDisconnect, refreshBucketView, selectedBucketId])

  const handleRecategorize = useCallback(async () => {
    setClassifying(true)
    setError(null)
    try {
      await recategorize()
      await refreshBucketView(selectedBucketId)
    } catch (err) {
      if (!handleAuthError(err, onDisconnect)) setError(err.message)
    } finally {
      setClassifying(false)
    }
  }, [onDisconnect, refreshBucketView, selectedBucketId])

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
    manageOpen,
    classifyComplete,
    removingBucketId,
    showDeleteConfirm,
    deletingData,
    setError,
    setNewBucketName,
    setManageOpen,
    setShowDeleteConfirm,
    setSelectedBucketId,
    handleFetchAndClassify,
    handleRecategorize,
    handleCreateBucket,
    handleDisconnect,
    handleDeleteAllData,
    handleRemoveBucket,
  }
}
