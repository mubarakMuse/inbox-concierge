import Button from '../ui/Button.jsx'

export default function AppHeader({
  onDisconnect,
  onManageToggle,
  manageOpen,
}) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <span className="app-logo" aria-hidden="true">✉</span>
        <div>
          <h1 className="app-title">Inbox Concierge</h1>
          <p className="app-tagline">Your inbox, sorted by AI</p>
        </div>
      </div>
      <div className="app-header-actions">
        <Button
          variant="ghost"
          className="btn-sm"
          onClick={onManageToggle}
          aria-expanded={manageOpen}
          aria-controls="manage-panel"
        >
          {manageOpen ? 'Close' : 'Manage'}
        </Button>
        <Button variant="ghost" className="btn-sm" onClick={onDisconnect} aria-label="Disconnect Gmail">
          Disconnect
        </Button>
      </div>
    </header>
  )
}
