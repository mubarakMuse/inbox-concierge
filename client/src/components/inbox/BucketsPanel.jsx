import AddBucketForm from './AddBucketForm.jsx'
import Button from '../ui/Button.jsx'

export default function BucketsPanel({
  open,
  buckets,
  needClassify,
  classifying,
  newBucketName,
  creatingBucket,
  removingBucketId,
  onNewBucketNameChange,
  onCreateBucket,
  onRemoveBucket,
  onRecategorize,
}) {
  if (!open) return null

  return (
    <section id="buckets-panel" className="manage-panel" aria-label="Bucket settings">
      <div className="manage-grid">
        <div className="manage-card">
          <h3 className="manage-heading">Custom bucket</h3>
          <p className="manage-hint">Add a label — we&apos;ll recategorize everything to include it.</p>
          <AddBucketForm
            value={newBucketName}
            onChange={onNewBucketNameChange}
            onSubmit={onCreateBucket}
            disabled={creatingBucket}
          />
          {buckets.filter((b) => !b.is_default).length > 0 && (
            <ul className="custom-bucket-list">
              {buckets.filter((b) => !b.is_default).map((b) => (
                <li key={b.id}>
                  <span>{b.name}</span>
                  <button
                    type="button"
                    className="bucket-remove"
                    onClick={(e) => onRemoveBucket(e, b.id)}
                    disabled={removingBucketId === b.id}
                    aria-label={`Remove bucket ${b.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!needClassify && (
          <div className="manage-card">
            <h3 className="manage-heading">Re-run AI</h3>
            <p className="manage-hint">Re-sort all cached mail with your current buckets. Use Refresh in the header to pull new mail from Gmail.</p>
            <Button
              variant="ghost"
              className="btn-block"
              onClick={onRecategorize}
              disabled={classifying}
              aria-label="Re-run AI on cached mail"
            >
              {classifying ? 'Re-sorting…' : 'Re-run AI on cached mail'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
