import ThreadItem from './ThreadItem.jsx'
import Button from '../ui/Button.jsx'
import { getBucketMeta } from '../../utils/buckets.js'

export default function ThreadList({
  threads,
  needClassify,
  loading,
  selectedBucket,
  selectedBucketId,
  buckets,
  onMoveThread,
  movingThreadId,
  onBrowseCanWait,
  onRefresh,
}) {
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
    const isImportant = selectedBucketId === 'important'
    return (
      <div className="empty-state-card">
        <span className="empty-icon" aria-hidden="true">{isImportant ? '✨' : '📭'}</span>
        <p className="empty-state-title">
          {isImportant ? "You're clear" : 'No emails here'}
        </p>
        <p className="empty-state-text">
          {isImportant
            ? 'Nothing urgent in the last 200. Browse Can wait, or Refresh for newer mail.'
            : 'This bucket is empty. Try another bucket, or Refresh to pull new mail.'}
        </p>
        {isImportant && (
          <div className="empty-state-actions">
            {onBrowseCanWait && (
              <Button variant="secondary" onClick={onBrowseCanWait} aria-label="Browse Can wait">
                Browse Can wait
              </Button>
            )}
            {onRefresh && (
              <Button variant="ghost" onClick={onRefresh} aria-label="Refresh inbox">
                Refresh
              </Button>
            )}
          </div>
        )}
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
          <ThreadItem
            thread={thread}
            bucketMeta={bucketMeta}
            currentBucketId={selectedBucketId}
            buckets={buckets}
            onMoveThread={onMoveThread}
            moving={movingThreadId === thread.id}
          />
        </div>
      ))}
    </div>
  )
}
