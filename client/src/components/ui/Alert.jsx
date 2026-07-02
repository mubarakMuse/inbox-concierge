import Button from './Button.jsx'

export default function Alert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="alert" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <Button variant="link" className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss error">
          Dismiss
        </Button>
      )}
    </div>
  )
}
