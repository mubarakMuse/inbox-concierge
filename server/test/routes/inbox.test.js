import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

vi.mock('../../lib/storage.js', () => ({
  getBuckets: vi.fn(),
  getClassifications: vi.fn(),
  getThreadsCache: vi.fn(),
  saveThreadsCache: vi.fn(),
  saveClassifications: vi.fn(),
}));
vi.mock('../../lib/gmail.js', () => ({ fetchThreads: vi.fn() }));
vi.mock('../../lib/classification.js', () => ({ classifyAll: vi.fn() }));
vi.mock('../../middleware/userId.js', () => ({
  userIdFromCookie: (req, _res, next) => {
    req.userId = req.headers['x-test-user'] || 'default';
    next();
  },
}));
vi.mock('../../middleware/requireGmailAuth.js', () => ({
  requireGmailAuth: (req, _res, next) => {
    if (req.headers['x-gmail-connected'] === 'true') {
      req.gmailAuth = { fake: true };
      next();
    } else {
      _res.status(401).json({ error: 'Gmail not connected. Please connect your account.' });
    }
  },
}));

const { getBuckets, getClassifications, getThreadsCache, saveClassifications, saveThreadsCache } = await import('../../lib/storage.js');
const { classifyAll } = await import('../../lib/classification.js');
const { fetchThreads } = await import('../../lib/gmail.js');

describe('GET /api/inbox/buckets', () => {
  beforeEach(() => {
    vi.mocked(getBuckets).mockReset();
    vi.mocked(getClassifications).mockReset();
  });

  it('returns buckets and counts', async () => {
    vi.mocked(getBuckets).mockResolvedValue([
      { id: 'important', name: 'Important', is_default: true },
      { id: 'other', name: 'Other', is_default: true },
    ]);
    vi.mocked(getClassifications).mockResolvedValue({
      t1: { bucket_id: 'important', reason: 'Urgent' },
      t2: { bucket_id: 'important', reason: '' },
      t3: { bucket_id: 'other', reason: '' },
    });
    const res = await request(app).get('/api/inbox/buckets').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(2);
    expect(res.body.counts).toEqual({ important: 2, other: 1 });
  });

  it('returns 500 when getBuckets throws', async () => {
    vi.mocked(getBuckets).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/inbox/buckets');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

describe('GET /api/inbox/threads', () => {
  beforeEach(() => {
    vi.mocked(getClassifications).mockReset();
    vi.mocked(getThreadsCache).mockReset();
  });

  it('returns 401 when Gmail not connected', async () => {
    const res = await request(app).get('/api/inbox/threads');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Gmail not connected');
  });

  it('returns needClassify: true when no threads cache', async () => {
    vi.mocked(getThreadsCache).mockResolvedValue(null);
    vi.mocked(getClassifications).mockResolvedValue({});
    const res = await request(app)
      .get('/api/inbox/threads')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(200);
    expect(res.body.threads).toEqual([]);
    expect(res.body.needClassify).toBe(true);
  });

  it('returns threads filtered by bucket_id', async () => {
    const threads = [
      { id: 't1', subject: 'Hello', snippet: 'Snippet 1' },
      { id: 't2', subject: 'World', snippet: 'Snippet 2' },
    ];
    vi.mocked(getThreadsCache).mockResolvedValue(threads);
    vi.mocked(getClassifications).mockResolvedValue({
      t1: { bucket_id: 'important', reason: 'Urgent' },
      t2: { bucket_id: 'other', reason: '' },
    });
    const res = await request(app)
      .get('/api/inbox/threads?bucket_id=important')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(200);
    expect(res.body.threads).toHaveLength(1);
    expect(res.body.threads[0].id).toBe('t1');
    expect(res.body.threads[0].reason).toBe('Urgent');
  });
});

describe('POST /api/inbox/recategorize', () => {
  beforeEach(() => {
    vi.mocked(getThreadsCache).mockReset();
    vi.mocked(classifyAll).mockReset();
    vi.mocked(saveClassifications).mockResolvedValue(undefined);
  });

  it('returns 401 when Gmail not connected', async () => {
    const res = await request(app).post('/api/inbox/recategorize');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no threads to recategorize', async () => {
    vi.mocked(getThreadsCache).mockResolvedValue(null);
    const res = await request(app)
      .post('/api/inbox/recategorize')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No threads');
  });

  it('returns 200 and classifications when success', async () => {
    const threads = [{ id: 't1', subject: 'S', snippet: '' }];
    vi.mocked(getThreadsCache).mockResolvedValue(threads);
    vi.mocked(classifyAll).mockResolvedValue({ t1: { bucket_id: 'important', reason: 'Urgent' } });
    const res = await request(app)
      .post('/api/inbox/recategorize')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(200);
    expect(res.body.classifications).toEqual({ t1: { bucket_id: 'important', reason: 'Urgent' } });
    expect(res.body.progress.done).toBe(1);
    expect(res.body.progress.total).toBe(1);
  });
});
