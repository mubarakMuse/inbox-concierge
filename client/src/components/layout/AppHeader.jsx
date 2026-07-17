import Button from '../ui/Button.jsx'
import { formatRelativeTime } from '../../utils/relativeTime.js'

export default function AppHeader({
  lastSortedAt,
  classifying,
  panel,
  onRefresh,
  onBucketsToggle,
  onAccountToggle,
}) {
  const freshness = formatRelativeTime(lastSortedAt)

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <span className="app-logo" aria-hidden="true">✉</span>
        <div>
          <h1 className="app-title">Inbox Concierge</h1>
          <p className="app-tagline">
            {freshness ? `Sorted ${freshness}` : 'Your inbox, sorted by AI'}
          </p>
        </div>
      </div>
      <div className="app-header-actions">
        <Button
          variant="secondary"
          className="btn-sm"
          onClick={onRefresh}
          disabled={classifying}
          aria-label="Refresh and reclassify inbox"
        >
          {classifying ? 'Sorting…' : 'Refresh'}
        </Button>
        <Button
          variant="ghost"
          className="btn-sm"
          onClick={onBucketsToggle}
          aria-expanded={panel === 'buckets'}
          aria-controls="buckets-panel"
        >
          {panel === 'buckets' ? 'Close' : 'Buckets'}
        </Button>
        <Button
          variant="ghost"
          className="btn-sm"
          onClick={onAccountToggle}
          aria-expanded={panel === 'account'}
          aria-controls="account-panel"
        >
          {panel === 'account' ? 'Close' : 'Account'}
        </Button>
      </div>
    </header>
  )
}
