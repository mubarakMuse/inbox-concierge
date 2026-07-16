import AppHeader from '../components/layout/AppHeader.jsx'
import BucketBar from '../components/inbox/BucketBar.jsx'
import WelcomeHero from '../components/inbox/WelcomeHero.jsx'
import ClassifyExperience from '../components/inbox/ClassifyExperience.jsx'
import ManagePanel from '../components/inbox/ManagePanel.jsx'
import ThreadList from '../components/inbox/ThreadList.jsx'
import { Alert } from '../components/ui/index.js'
import { useInbox } from '../hooks/useInbox.js'
import { getBucketMeta } from '../utils/buckets.js'

export default function Inbox({ onDisconnect }) {
  const inbox = useInbox(onDisconnect)
  const showWelcome = inbox.needClassify && !inbox.classifying
  const meta = inbox.selectedBucket ? getBucketMeta(inbox.selectedBucket) : null

  return (
    <div className="app-shell">
      <AppHeader
        onDisconnect={inbox.handleDisconnect}
        onManageToggle={() => inbox.setManageOpen((o) => !o)}
        manageOpen={inbox.manageOpen}
      />

      <BucketBar
        buckets={inbox.buckets}
        counts={inbox.counts}
        selectedBucketId={inbox.selectedBucketId}
        classifying={inbox.classifying}
        onSelect={inbox.setSelectedBucketId}
      />

      <ManagePanel
        open={inbox.manageOpen}
        buckets={inbox.buckets}
        needClassify={inbox.needClassify}
        classifying={inbox.classifying}
        progress={inbox.progress}
        newBucketName={inbox.newBucketName}
        creatingBucket={inbox.creatingBucket}
        removingBucketId={inbox.removingBucketId}
        showDeleteConfirm={inbox.showDeleteConfirm}
        deletingData={inbox.deletingData}
        onNewBucketNameChange={inbox.setNewBucketName}
        onCreateBucket={inbox.handleCreateBucket}
        onFetchAndClassify={inbox.handleFetchAndClassify}
        onRecategorize={inbox.handleRecategorize}
        onRemoveBucket={inbox.handleRemoveBucket}
        onDeleteClick={inbox.handleDeleteAllData}
        onCancelDelete={() => inbox.setShowDeleteConfirm(false)}
        onConfirmDelete={inbox.handleDeleteAllData}
      />

      {inbox.classifyComplete && (
        <div className="toast toast-success" role="status" aria-live="polite">
          ✓ Inbox sorted — browse your buckets above
        </div>
      )}

      <main className="inbox-main" id="inbox-main" role="main" aria-label="Email list">
        <Alert message={inbox.error} onDismiss={() => inbox.setError(null)} />

        {showWelcome && (
          <WelcomeHero onStart={inbox.handleFetchAndClassify} classifying={inbox.classifying} />
        )}

        {!showWelcome && (
          <>
            <header className="inbox-main-header">
              {meta && (
                <span className="inbox-bucket-icon" style={{ background: meta.bg, color: meta.color }} aria-hidden="true">
                  {meta.icon}
                </span>
              )}
              <div>
                <p className="inbox-main-eyebrow">{meta?.description || 'Bucket'}</p>
                <h2 className="inbox-main-title">{inbox.selectedBucket?.name || 'Inbox'}</h2>
              </div>
              <span className="inbox-main-count">
                {inbox.counts[inbox.selectedBucketId] ?? 0} emails
              </span>
            </header>

            <ThreadList
              threads={inbox.threads}
              needClassify={inbox.needClassify}
              loading={inbox.loading}
              selectedBucket={inbox.selectedBucket}
            />
          </>
        )}
      </main>

      {inbox.classifying && inbox.progress.total > 0 && (
        <ClassifyExperience done={inbox.progress.done} total={inbox.progress.total} />
      )}
    </div>
  )
}
