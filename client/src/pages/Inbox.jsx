import AppHeader from '../components/layout/AppHeader.jsx'
import BucketBar from '../components/inbox/BucketBar.jsx'
import WelcomeHero from '../components/inbox/WelcomeHero.jsx'
import ClassifyExperience from '../components/inbox/ClassifyExperience.jsx'
import BucketsPanel from '../components/inbox/BucketsPanel.jsx'
import AccountPanel from '../components/inbox/AccountPanel.jsx'
import ThreadList from '../components/inbox/ThreadList.jsx'
import { Alert } from '../components/ui/index.js'
import { useInbox } from '../hooks/useInbox.js'
import { getBucketMeta } from '../utils/buckets.js'

const buildSummaryLine = (counts) => {
  const importantCount = counts.important ?? 0
  const canWaitCount = counts['can-wait'] ?? 0
  const noiseCount =
    (counts['auto-archive'] ?? 0) + (counts.newsletter ?? 0) + (counts.other ?? 0)
  return `${importantCount} need you · ${canWaitCount} can wait · ${noiseCount} noise`
}

export default function Inbox({ onDisconnect }) {
  const inbox = useInbox(onDisconnect)
  const showWelcome = inbox.needClassify && !inbox.classifying
  const meta = inbox.selectedBucket ? getBucketMeta(inbox.selectedBucket) : null
  const summaryLine = !inbox.needClassify ? buildSummaryLine(inbox.counts) : null

  return (
    <div className="app-shell">
      <AppHeader
        lastSortedAt={inbox.lastSortedAt}
        classifying={inbox.classifying}
        panel={inbox.panel}
        onRefresh={inbox.handleFetchAndClassify}
        onBucketsToggle={() => inbox.handleTogglePanel('buckets')}
        onAccountToggle={() => inbox.handleTogglePanel('account')}
      />

      <BucketBar
        buckets={inbox.buckets}
        counts={inbox.counts}
        selectedBucketId={inbox.selectedBucketId}
        classifying={inbox.classifying}
        onSelect={inbox.setSelectedBucketId}
      />

      <BucketsPanel
        open={inbox.panel === 'buckets'}
        buckets={inbox.buckets}
        needClassify={inbox.needClassify}
        classifying={inbox.classifying}
        newBucketName={inbox.newBucketName}
        creatingBucket={inbox.creatingBucket}
        removingBucketId={inbox.removingBucketId}
        onNewBucketNameChange={inbox.setNewBucketName}
        onCreateBucket={inbox.handleCreateBucket}
        onRemoveBucket={inbox.handleRemoveBucket}
        onRecategorize={inbox.handleRecategorize}
      />

      <AccountPanel
        open={inbox.panel === 'account'}
        showDeleteConfirm={inbox.showDeleteConfirm}
        deletingData={inbox.deletingData}
        onDisconnect={inbox.handleDisconnect}
        onDeleteClick={inbox.handleDeleteAllData}
        onCancelDelete={() => inbox.setShowDeleteConfirm(false)}
        onConfirmDelete={inbox.handleDeleteAllData}
      />

      {inbox.classifyComplete && (
        <div className="toast toast-success" role="status" aria-live="polite">
          ✓ Inbox sorted — Important first
        </div>
      )}

      <main className="inbox-main" id="inbox-main" role="main" aria-label="Email list">
        <Alert message={inbox.error} onDismiss={() => inbox.setError(null)} />

        {showWelcome && (
          <WelcomeHero onStart={inbox.handleFetchAndClassify} classifying={inbox.classifying} />
        )}

        {!showWelcome && (
          <>
            {summaryLine && (
              <p className="inbox-summary" aria-live="polite">
                {summaryLine}
              </p>
            )}

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
              selectedBucketId={inbox.selectedBucketId}
              buckets={inbox.buckets}
              onMoveThread={inbox.handleMoveThread}
              movingThreadId={inbox.movingThreadId}
              onBrowseCanWait={() => inbox.setSelectedBucketId('can-wait')}
              onRefresh={inbox.handleFetchAndClassify}
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
