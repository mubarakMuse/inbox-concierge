import AddBucketForm from './AddBucketForm.jsx'
import Button from '../ui/Button.jsx'

export default function ManagePanel({
  open,
  buckets,
  needClassify,
  classifying,
  progress,
  newBucketName,
  creatingBucket,
  removingBucketId,
  showDeleteConfirm,
  deletingData,
  onNewBucketNameChange,
  onCreateBucket,
  onFetchAndClassify,
  onRecategorize,
  onRemoveBucket,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  if (!open) return null

  return (
    <section id="manage-panel" className="manage-panel" aria-label="Inbox settings">
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
            <h3 className="manage-heading">Refresh</h3>
            <p className="manage-hint">Pull new mail from Gmail or rerun AI on cached threads.</p>
            <div className="manage-actions">
              <Button
                variant="secondary"
                className="btn-block"
                onClick={onFetchAndClassify}
                disabled={classifying}
                aria-label="Refetch inbox from Gmail"
              >
                {classifying ? `Refetching… ${progress.done}/${progress.total}` : 'Refetch inbox'}
              </Button>
              <Button
                variant="secondary"
                className="btn-block"
                onClick={onRecategorize}
                disabled={classifying}
                aria-label="Recategorize all with current buckets"
              >
                {classifying ? 'Recategorizing…' : 'Recategorize all'}
              </Button>
            </div>
          </div>
        )}
        <div className="manage-card manage-card-danger">
          <h3 className="manage-heading">Data</h3>
          {showDeleteConfirm ? (
            <>
              <p className="manage-hint">Remove all buckets, classifications, and cached emails. You will be signed out.</p>
              <div className="manage-actions">
                <Button variant="ghost" onClick={onCancelDelete} disabled={deletingData}>Cancel</Button>
                <Button variant="danger" onClick={onConfirmDelete} disabled={deletingData} aria-busy={deletingData}>
                  {deletingData ? 'Deleting…' : 'Delete all'}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="link" className="delete-link" onClick={onDeleteClick} aria-label="Delete all my data">
              Delete all my data
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
