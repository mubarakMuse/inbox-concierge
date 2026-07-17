import { decodeHtmlEntities } from '../../utils/decodeHtml.js'
import { getBucketMeta } from '../../utils/buckets.js'

const SHORT_LABELS = {
  important: 'Important',
  'can-wait': 'Wait',
  'auto-archive': 'Archive',
  newsletter: 'Newsletter',
  other: 'Other',
}

const getMoveLabel = (bucket) => {
  if (SHORT_LABELS[bucket.id]) return SHORT_LABELS[bucket.id]
  return getBucketMeta(bucket).label
}

export default function ThreadItem({
  thread,
  bucketMeta,
  currentBucketId,
  buckets,
  onMoveThread,
  moving,
}) {
  const reason = thread.reason ? decodeHtmlEntities(thread.reason) : null
  const fallbackReason = bucketMeta
    ? `Sorted into ${bucketMeta.label}`
    : 'Sorted by AI'
  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(thread.id)}`

  const moveOptions = (buckets || [])
    .filter((bucket) => bucket.id !== currentBucketId)
    .map((bucket) => ({
      id: bucket.id,
      label: getMoveLabel(bucket),
    }))

  const handleMove = (bucketId) => {
    if (moving || !onMoveThread) return
    onMoveThread(thread.id, bucketId)
  }

  const handleMoveKeyDown = (e, bucketId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleMove(bucketId)
    }
  }

  return (
    <article className="thread-card" role="listitem">
      <p className="thread-reason">{reason || fallbackReason}</p>
      <h3 className="thread-subject">{decodeHtmlEntities(thread.subject)}</h3>
      <p className="thread-snippet">{decodeHtmlEntities(thread.snippet)}</p>

      <div className="thread-actions">
        <div className="thread-move" role="group" aria-label="Wrong bucket?">
          <span className="thread-move-label">Wrong bucket?</span>
          <div className="thread-move-chips">
            {moveOptions.map((target) => (
              <button
                key={target.id}
                type="button"
                className="thread-move-chip"
                onClick={() => handleMove(target.id)}
                onKeyDown={(e) => handleMoveKeyDown(e, target.id)}
                disabled={moving}
                tabIndex={0}
                aria-label={`Move to ${target.label}`}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
        <a
          className="thread-gmail-link"
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in Gmail"
        >
          Open in Gmail
        </a>
      </div>
    </article>
  )
}
