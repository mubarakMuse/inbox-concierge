import { useEffect, useState } from 'react'
import { getAuthUrl } from '../api/index.js'
import { Button } from '../components/ui/index.js'

const STEPS = [
  { icon: '🔗', title: 'Connect Gmail', desc: 'Secure OAuth — we never see your password' },
  { icon: '🤖', title: 'AI sorts 200 threads', desc: 'Subject + snippet only, fast and private' },
  { icon: '🎯', title: 'Focus on what matters', desc: 'Important first, newsletters later' },
]

export default function Login({ onConnect }) {
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') !== 'success') return
    onConnect()
    window.history.replaceState({}, '', '/')
  }, [onConnect])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const url = await getAuthUrl()
      window.location.href = url
    } catch (err) {
      alert(err.message || 'Failed to start sign-in')
      setConnecting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-hero">
          <p className="login-eyebrow">Gmail + AI</p>
          <h1 className="login-title">Inbox Concierge</h1>
          <p className="login-subtitle">
            Stop drowning in email. We fetch your latest threads and sort them into clear buckets —
            so you open Gmail knowing exactly where to look.
          </p>
          <Button
            variant="primary"
            className="login-btn"
            onClick={handleConnect}
            disabled={connecting}
            aria-label="Connect Gmail to get started"
          >
            {connecting ? 'Redirecting…' : 'Connect Gmail'}
          </Button>
        </section>
        <section className="login-steps" aria-label="How it works">
          {STEPS.map((step) => (
            <div key={step.title} className="login-step-card">
              <span className="login-step-icon" aria-hidden="true">{step.icon}</span>
              <div>
                <h2 className="login-step-title">{step.title}</h2>
                <p className="login-step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
