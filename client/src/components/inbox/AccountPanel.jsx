import Button from '../ui/Button.jsx'

export default function AccountPanel({
  open,
  showDeleteConfirm,
  deletingData,
  classifying,
  onDisconnect,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  if (!open) return null

  return (
    <section id="account-panel" className="manage-panel" aria-label="Account settings">
      <div className="manage-grid">
        <div className="manage-card">
          <h3 className="manage-heading">Gmail</h3>
          <p className="manage-hint">
            {classifying
              ? 'Finish sorting before disconnecting, or delete your data to cancel.'
              : 'Disconnect this account. Your sorted buckets stay until you delete data.'}
          </p>
          <Button
            variant="ghost"
            className="btn-block"
            onClick={onDisconnect}
            disabled={classifying || deletingData}
            aria-label="Disconnect Gmail"
          >
            Disconnect Gmail
          </Button>
        </div>
        <div className="manage-card manage-card-danger">
          <h3 className="manage-heading">Data</h3>
          {showDeleteConfirm ? (
            <>
              <p className="manage-hint">
                {classifying
                  ? 'This cancels sorting and removes all buckets, classifications, and cached emails. You will be signed out.'
                  : 'Remove all buckets, classifications, and cached emails. You will be signed out.'}
              </p>
              <div className="manage-actions">
                <Button variant="ghost" onClick={onCancelDelete} disabled={deletingData}>Cancel</Button>
                <Button variant="danger" onClick={onConfirmDelete} disabled={deletingData} aria-busy={deletingData}>
                  {deletingData ? 'Deleting…' : 'Delete all'}
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="link"
              className="delete-link"
              onClick={onDeleteClick}
              disabled={deletingData}
              aria-label="Delete all my data"
            >
              Delete all my data
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
