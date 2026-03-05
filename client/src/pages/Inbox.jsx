import React, { useEffect, useState } from 'react';
import {
  getBucketsWithCounts,
  getThreads,
  classifyWithProgress,
  recategorize,
  createBucket,
  deleteBucket,
  disconnect,
  deleteAllMyData,
} from '../api';

/** Decode HTML entities in Gmail text so "don&amp;#39;t" displays as "don't" */
function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export default function Inbox({ onDisconnect }) {
  const [buckets, setBuckets] = useState([]);
  const [counts, setCounts] = useState({});
  const [selectedBucketId, setSelectedBucketId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [needClassify, setNeedClassify] = useState(false);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [newBucketName, setNewBucketName] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [error, setError] = useState(null);
  const [expandedReasonId, setExpandedReasonId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [removingBucketId, setRemovingBucketId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  async function loadBuckets() {
    try {
      const data = await getBucketsWithCounts();
      setBuckets(data.buckets);
      setCounts(data.counts || {});
      if (!selectedBucketId && data.buckets?.length) setSelectedBucketId(data.buckets[0].id);
    } catch (e) {
      if (e.status === 401) onDisconnect();
      else setError(e.message);
    }
  }

  async function loadThreads() {
    if (!selectedBucketId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getThreads(selectedBucketId);
      setThreads(data.threads || []);
      setNeedClassify(!!data.needClassify);
    } catch (e) {
      if (e.status === 401) onDisconnect();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when selected bucket changes
  }, [selectedBucketId]);

  async function handleFetchAndClassify() {
    setClassifying(true);
    setProgress({ done: 0, total: 200 });
    setError(null);
    const bucketId = selectedBucketId;
    classifyWithProgress(
      (payload) => {
        setProgress({ done: payload.done ?? 0, total: payload.total ?? 200 });
        loadBuckets().then(() => {
          if (bucketId) getThreads(bucketId).then((data) => {
            setThreads(data.threads || []);
            setNeedClassify(!!data.needClassify);
          });
        });
      },
      () => {
        setNeedClassify(false);
        loadBuckets().then(() => {
          if (bucketId) loadThreads();
        });
        setClassifying(false);
      },
      (err, status) => {
        if (status === 401) onDisconnect();
        else setError(err || 'Classification failed');
        setClassifying(false);
      }
    );
  }

  async function handleRecategorize() {
    setClassifying(true);
    setError(null);
    try {
      await recategorize();
      await loadBuckets();
      await loadThreads();
    } catch (e) {
      if (e.status === 401) onDisconnect();
      else setError(e.message);
    } finally {
      setClassifying(false);
    }
  }

  async function handleCreateBucket(e) {
    e.preventDefault();
    const name = newBucketName.trim();
    if (!name) return;
    setCreatingBucket(true);
    setError(null);
    try {
      await createBucket(name);
      setNewBucketName('');
      await loadBuckets();
      setSelectedBucketId(name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
      await handleRecategorize();
    } catch (e) {
      if (e.status === 401) onDisconnect();
      else setError(e.message);
    } finally {
      setCreatingBucket(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      onDisconnect();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteAllData() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    setDeletingData(true);
    setError(null);
    try {
      await deleteAllMyData();
      onDisconnect();
    } catch (e) {
      setError(e.message);
      setDeletingData(false);
    }
  }

  async function handleRemoveBucket(e, bucketId) {
    e.stopPropagation();
    setRemovingBucketId(bucketId);
    setError(null);
    try {
      await deleteBucket(bucketId);
      if (selectedBucketId === bucketId) {
        setSelectedBucketId('other');
      }
      await loadBuckets();
      await loadThreads();
    } catch (e) {
      if (e.status === 401) onDisconnect();
      else setError(e.message);
    } finally {
      setRemovingBucketId(null);
    }
  }

  return (
    <div style={styles.layout}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        style={styles.sidebarToggle}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>
      {sidebarOpen && <div role="button" tabIndex={0} aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)} style={{ ...styles.overlay, display: 'block' }} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-drawer-open' : ''}`} style={{ ...styles.sidebar, ...(sidebarOpen ? styles.sidebarOpen : {}) }} aria-label="Bucket navigation">
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>Inbox Concierge</h2>
          <div style={styles.headerActions}>
            <button type="button" onClick={handleDisconnect} style={styles.disconnectBtn} aria-label="Disconnect Gmail">
              Disconnect
            </button>
          </div>
        </div>
        {showDeleteConfirm ? (
          <div style={styles.deleteConfirm}>
            <p style={styles.deleteConfirmText}>Remove all your buckets, classifications, and cached emails. You will be signed out.</p>
            <div style={styles.deleteConfirmBtns}>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} style={styles.secondaryBtn} disabled={deletingData}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteAllData} style={styles.deleteAllBtn} disabled={deletingData} aria-busy={deletingData}>
                {deletingData ? 'Deleting…' : 'Delete all'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleDeleteAllData} style={styles.deleteAllLink} aria-label="Delete all my data">
            Delete all my data
          </button>
        )}
        {needClassify && (
          <div style={styles.alert} role="status">
            <p style={{ margin: '0 0 8px' }}>Emails not classified yet.</p>
            <button
              type="button"
              onClick={handleFetchAndClassify}
              disabled={classifying}
              style={styles.primaryBtn}
              aria-busy={classifying}
              aria-label={classifying ? 'Classifying emails' : 'Fetch and classify emails'}
            >
              {classifying ? `Classifying… ${progress.done}/${progress.total}` : 'Fetch & classify emails'}
            </button>
          </div>
        )}
        <form onSubmit={handleCreateBucket} style={styles.addBucket} aria-label="Add new bucket">
          <input
            type="text"
            placeholder="New bucket name"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            style={styles.input}
            disabled={creatingBucket}
            aria-label="New bucket name"
          />
          <button type="submit" disabled={creatingBucket || !newBucketName.trim()} style={styles.addBucketBtn} aria-label="Add bucket and recategorize">
            Add
          </button>
        </form>
        {!needClassify && buckets?.length > 0 && (
          <div style={styles.recategorizeSection}>
            <button
              type="button"
              onClick={handleFetchAndClassify}
              disabled={classifying}
              style={styles.secondaryBtn}
              aria-busy={classifying}
              aria-label="Refetch inbox from Gmail"
            >
              {classifying ? `Refetching… ${progress.done}/${progress.total}` : 'Refetch inbox'}
            </button>
            <button
              type="button"
              onClick={handleRecategorize}
              disabled={classifying}
              style={styles.secondaryBtn}
              aria-busy={classifying}
              aria-label="Recategorize all with current buckets"
            >
              {classifying ? 'Recategorizing…' : 'Recategorize all'}
            </button>
          </div>
        )}
        <nav style={styles.nav} aria-label="Buckets">
          {(buckets || []).map((b) => (
            <div key={b.id} style={styles.bucketRow} data-bucket-row>
              <button
                type="button"
                onClick={() => { setSelectedBucketId(b.id); setSidebarOpen(false); }}
                style={{
                  ...styles.bucketBtn,
                  ...(selectedBucketId === b.id ? styles.bucketBtnActive : {}),
                }}
                aria-current={selectedBucketId === b.id ? 'true' : undefined}
                aria-label={`${b.name}, ${counts[b.id] ?? 0} emails`}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') e.target.closest('[data-bucket-row]')?.nextElementSibling?.querySelector('button')?.focus();
                  if (e.key === 'ArrowUp') e.target.closest('[data-bucket-row]')?.previousElementSibling?.querySelector('button')?.focus();
                }}
                data-bucket-id={b.id}
              >
                <span style={styles.bucketName}>{b.name}</span>
                <span style={styles.bucketCount}>{counts[b.id] ?? 0}</span>
              </button>
              {!b.is_default && (
                <button
                  type="button"
                  className="bucket-remove-btn"
                  onClick={(e) => handleRemoveBucket(e, b.id)}
                  disabled={removingBucketId === b.id}
                  aria-label={`Remove bucket ${b.name}`}
                  style={styles.bucketRemoveBtn}
                  title="Remove bucket"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <main style={styles.main} id="inbox-main" role="main" aria-label="Email list">
        {error && (
          <div style={styles.error} role="alert">
            {error}
            <button type="button" onClick={() => setError(null)} style={styles.dismissBtn} aria-label="Dismiss error">Dismiss</button>
          </div>
        )}
        {classifying && progress.total > 0 && (
          <div style={styles.progress} role="status" aria-live="polite">
            Classifying… {progress.done} / {progress.total}
          </div>
        )}
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : (
          <div style={styles.threadList} role="list">
            {threads.length === 0 ? (
              <p style={styles.muted}>
                {needClassify
                  ? 'Connect Gmail and click “Fetch & classify emails” to start.'
                  : 'No emails in this bucket.'}
              </p>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  style={styles.thread}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${t.subject}${t.reason ? `. Reason: ${t.reason}` : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') e.target.nextElementSibling?.focus();
                    if (e.key === 'ArrowUp') e.target.previousElementSibling?.focus();
                  }}
                >
                  <div style={styles.threadSubject}>{decodeHtmlEntities(t.subject)}</div>
                  <div style={styles.threadSnippet}>{decodeHtmlEntities(t.snippet)}</div>
                  {t.reason && (
                    <div style={styles.threadReasonWrap}>
                      <button
                        type="button"
                        className="why-btn"
                        onClick={() => setExpandedReasonId(expandedReasonId === t.id ? null : t.id)}
                        title={decodeHtmlEntities(t.reason)}
                        aria-label="Why this bucket"
                        aria-expanded={expandedReasonId === t.id}
                        style={styles.whyBtn}
                      >
                        Why?
                      </button>
                      {expandedReasonId === t.id && <span style={styles.threadReason}>{decodeHtmlEntities(t.reason)}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 280,
    borderRight: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: 16,
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { margin: 0, fontSize: 18, fontWeight: 700 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  disconnectBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteConfirm: {
    padding: 12,
    margin: 12,
    background: 'var(--bg)',
    borderRadius: 8,
    border: '1px solid var(--danger)',
  },
  deleteConfirmText: { margin: '0 0 12px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 },
  deleteConfirmBtns: { display: 'flex', gap: 8 },
  deleteAllBtn: {
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteAllLink: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    padding: '8px 16px',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  alert: {
    padding: 12,
    margin: 12,
    background: 'var(--bg)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  addBucket: {
    padding: 12,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 12px',
    color: 'var(--text)',
    fontSize: 14,
  },
  addBucketBtn: {
    flexShrink: 0,
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
  },
  recategorizeSection: { padding: '0 12px 12px' },
  nav: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
  },
  bucketRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  bucketBtn: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
  bucketRemoveBtn: {
    flexShrink: 0,
    width: 28,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--muted)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
  },
  bucketBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
  },
  bucketName: { fontWeight: 500 },
  bucketCount: { color: 'var(--muted)', fontSize: 13 },
  main: {
    flex: 1,
    padding: 24,
    overflow: 'auto',
  },
  error: {
    background: 'rgba(248,113,113,0.15)',
    border: '1px solid var(--danger)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: 12,
  },
  progress: {
    padding: 8,
    marginBottom: 16,
    color: 'var(--muted)',
    fontSize: 14,
  },
  muted: { color: 'var(--muted)', margin: 0 },
  threadList: {},
  thread: {
    borderBottom: '1px solid var(--border)',
    padding: '14px 0',
  },
  threadSubject: { fontWeight: 600, fontSize: 15, marginBottom: 4, lineHeight: 1.35 },
  threadSnippet: { color: 'var(--muted)', fontSize: 14, lineHeight: 1.45, marginBottom: 6 },
  threadReasonWrap: { marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  whyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    padding: 0,
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  threadReason: { fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 },
  sidebarToggle: {
    display: 'none',
    position: 'fixed',
    top: 12,
    left: 12,
    zIndex: 1001,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 18,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  sidebarOpen: {},
};
