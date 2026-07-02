import ThreadItem from './ThreadItem.jsx'
import { getBucketMeta } from '../../utils/buckets.js'

export default function ThreadList({ threads, needClassify, loading, selectedBucket }) {
  if (loading) {
    return (
      <div className="thread-skeleton-list" aria-busy="true" aria-label="Loading emails">
        {[1, 2, 3].map((i) => (
          <div key={i} className="thread-skeleton" />
        ))}
      </div>
    )
  }

  if (threads.length === 0 && !needClassify) {
    return (
      <div className="empty-state-card">
        <span className="empty-icon" aria-hidden="true">📭</span>
        <p className="empty-state-title">No emails here</p>
        <p className="empty-state-text">
          This bucket is empty. Try another bucket or run Recategorize from Manage.
        </p>
      </div>
    )
  }

  if (threads.length === 0) return null

  const bucketMeta = selectedBucket ? getBucketMeta(selectedBucket) : null

  return (
    <div className="thread-list" role="list" aria-label="Email list">
      {threads.map((thread, index) => (
        <div
          key={thread.id}
          className="thread-enter"
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <ThreadItem thread={thread} bucketMeta={bucketMeta} />
        </div>
      ))}
    </div>
  )
}
