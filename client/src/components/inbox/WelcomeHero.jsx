import Button from '../ui/Button.jsx'

export default function WelcomeHero({ onStart, classifying }) {
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-visual" aria-hidden="true">
        <div className="welcome-orbit welcome-orbit-1">⚡</div>
        <div className="welcome-orbit welcome-orbit-2">📰</div>
        <div className="welcome-orbit welcome-orbit-3">🕐</div>
        <div className="welcome-core">✉</div>
      </div>
      <h2 id="welcome-title" className="welcome-title">Your inbox, untangled</h2>
      <p className="welcome-text">
        Emails not classified yet. We&apos;ll fetch your latest 200 Gmail threads and sort them into
        smart buckets — so you see what matters first.
      </p>
      <ul className="welcome-steps">
        <li><span>1</span> Fetch recent threads from Gmail</li>
        <li><span>2</span> AI reads subject + snippet</li>
        <li><span>3</span> Browse by bucket instantly</li>
      </ul>
      <Button
        variant="primary"
        className="welcome-cta"
        onClick={onStart}
        disabled={classifying}
        aria-busy={classifying}
        aria-label={classifying ? 'Classifying emails' : 'Fetch and classify emails'}
      >
        {classifying ? 'Starting…' : 'Fetch & classify emails'}
      </Button>
    </section>
  )
}
