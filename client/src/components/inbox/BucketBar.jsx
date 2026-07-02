import { getBucketMeta } from '../../utils/buckets.js'

export default function BucketBar({
  buckets,
  counts,
  selectedBucketId,
  classifying,
  onSelect,
}) {
  if (!buckets.length) return null

  return (
    <nav className="bucket-bar" aria-label="Buckets">
      <div className="bucket-bar-scroll">
        {buckets.map((bucket) => {
          const meta = getBucketMeta(bucket)
          const count = counts[bucket.id] ?? 0
          const isActive = selectedBucketId === bucket.id
          return (
            <button
              key={bucket.id}
              type="button"
              className={`bucket-chip${isActive ? ' bucket-chip-active' : ''}${classifying ? ' bucket-chip-live' : ''}`}
              onClick={() => onSelect(bucket.id)}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`${bucket.name}, ${count} emails`}
              style={{
                '--chip-color': meta.color,
                '--chip-bg': meta.bg,
              }}
            >
              <span className="bucket-chip-icon" aria-hidden="true">{meta.icon}</span>
              <span className="bucket-chip-label">{bucket.name}</span>
              <span className={`bucket-chip-count${count > 0 ? ' has-count' : ''}`}>{count}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
