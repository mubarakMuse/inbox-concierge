import React, { useEffect } from 'react';
import { getAuthUrl } from '../api';

export default function Login({ onConnect }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      onConnect();
      window.history.replaceState({}, '', '/');
      return;
    }
    if (params.get('auth') === 'error') {
    }
  }, [onConnect]);

  async function handleConnect() {
    try {
      const url = await getAuthUrl();
      window.location.href = url;
    } catch (err) {
      alert(err.message || 'Failed to start sign-in');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Inbox Concierge</h1>
        <p style={styles.subtitle}>Group your Gmail into buckets with AI</p>
        <button type="button" onClick={handleConnect} style={styles.button} aria-label="Connect Gmail to get started">
          Connect Gmail
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 48,
    maxWidth: 400,
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 28,
    fontWeight: 700,
  },
  subtitle: {
    margin: '0 0 32px',
    color: 'var(--muted)',
    fontSize: 16,
  },
  button: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
