import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

vi.mock('../../lib/storage.js', () => ({
  getBuckets: vi.fn(),
  getClassifications: vi.fn(),
  getThreadsCache: vi.fn(),
  saveThreadsCache: vi.fn(),
  saveClassifications: vi.fn(),
  updateThreadClassification: vi.fn(),
  getLastSortedAt: vi.fn(),
  createJob: vi.fn(),
  getActiveJob: vi.fn(),
  getJob: vi.fn(),
  updateJob: vi.fn(),
}));
vi.mock('../../lib/queue.js', () => ({
  enqueueJob: vi.fn().mockResolvedValue(undefined),
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

const {
  getBuckets,
  getClassifications,
  getThreadsCache,
  createJob,
  getActiveJob,
  getJob,
  updateThreadClassification,
  getLastSortedAt,
} = await import('../../lib/storage.js');
const { enqueueJob } = await import('../../lib/queue.js');

describe('GET /api/inbox/buckets', () => {
  beforeEach(() => {
    vi.mocked(getBuckets).mockReset();
    vi.mocked(getClassifications).mockReset();
    vi.mocked(getLastSortedAt).mockReset().mockResolvedValue(null);
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
    vi.mocked(getLastSortedAt).mockResolvedValue('2026-07-17T12:00:00.000Z');
    const res = await request(app).get('/api/inbox/buckets').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(2);
    expect(res.body.counts).toEqual({ important: 2, other: 1 });
    expect(res.body.lastSortedAt).toBe('2026-07-17T12:00:00.000Z');
  });

  it('returns lastSortedAt null when never sorted', async () => {
    vi.mocked(getBuckets).mockResolvedValue([
      { id: 'important', name: 'Important', is_default: true },
    ]);
    vi.mocked(getClassifications).mockResolvedValue({});
    vi.mocked(getLastSortedAt).mockResolvedValue(null);
    const res = await request(app).get('/api/inbox/buckets').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.lastSortedAt).toBeNull();
  });

  it('returns 500 when getBuckets throws', async () => {
    vi.mocked(getBuckets).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/inbox/buckets');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

describe('PATCH /api/inbox/threads/:threadId', () => {
  beforeEach(() => {
    vi.mocked(getBuckets).mockReset();
    vi.mocked(updateThreadClassification).mockReset();
  });

  it('upserts classification and returns thread_id, bucket_id, reason', async () => {
    vi.mocked(getBuckets).mockResolvedValue([
      { id: 'important', name: 'Important', is_default: true },
      { id: 'can-wait', name: 'Can wait', is_default: true },
    ]);
    vi.mocked(updateThreadClassification).mockResolvedValue({
      thread_id: 't1',
      bucket_id: 'can-wait',
      reason: 'Moved by user',
    });
    const res = await request(app)
      .patch('/api/inbox/threads/t1')
      .set('x-test-user', 'user-1')
      .send({ bucket_id: 'can-wait', reason: 'Moved by user' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      thread_id: 't1',
      bucket_id: 'can-wait',
      reason: 'Moved by user',
    });
    expect(updateThreadClassification).toHaveBeenCalledWith(
      't1',
      'can-wait',
      'Moved by user',
      'user-1'
    );
  });

  it('returns 400 when bucket_id missing', async () => {
    const res = await request(app)
      .patch('/api/inbox/threads/t1')
      .set('x-test-user', 'user-1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('bucket_id');
  });

  it('returns 400 when bucket does not exist for user', async () => {
    vi.mocked(getBuckets).mockResolvedValue([
      { id: 'important', name: 'Important', is_default: true },
    ]);
    const res = await request(app)
      .patch('/api/inbox/threads/t1')
      .set('x-test-user', 'user-1')
      .send({ bucket_id: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bucket not found');
    expect(updateThreadClassification).not.toHaveBeenCalled();
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
    vi.mocked(createJob).mockReset();
    vi.mocked(getActiveJob).mockReset().mockResolvedValue(null);
    vi.mocked(enqueueJob).mockReset().mockResolvedValue(undefined);
  });

  it('returns 401 when Gmail not connected', async () => {
    const res = await request(app).post('/api/inbox/recategorize');
    expect(res.status).toBe(401);
  });

  it('returns 200 with jobId and enqueues job', async () => {
    vi.mocked(createJob).mockImplementation(async ({ id, userId, type }) => ({
      id,
      user_id: userId,
      type,
      status: 'queued',
      done: 0,
      total: 0,
    }));
    const res = await request(app)
      .post('/api/inbox/recategorize')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeTruthy();
    expect(res.body.reused).toBe(false);
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'recategorize' })
    );
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'recategorize', jobId: res.body.jobId })
    );
  });

  it('returns existing active job without creating another', async () => {
    vi.mocked(getActiveJob).mockResolvedValue({
      id: 'active-1',
      user_id: 'user-1',
      type: 'recategorize',
      status: 'running',
    });
    const res = await request(app)
      .post('/api/inbox/recategorize')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ jobId: 'active-1', reused: true });
    expect(createJob).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe('GET /api/inbox/jobs/active', () => {
  beforeEach(() => {
    vi.mocked(getActiveJob).mockReset();
  });

  it('returns active job when present', async () => {
    vi.mocked(getActiveJob).mockResolvedValue({
      id: 'job-active',
      user_id: 'user-1',
      type: 'classify',
      status: 'running',
      done: 3,
      total: 10,
    });
    const res = await request(app)
      .get('/api/inbox/jobs/active')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.job).toEqual(
      expect.objectContaining({ id: 'job-active', status: 'running' })
    );
  });

  it('returns job null when none active', async () => {
    vi.mocked(getActiveJob).mockResolvedValue(null);
    const res = await request(app)
      .get('/api/inbox/jobs/active')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ job: null });
  });
});

describe('GET /api/inbox/jobs/:jobId', () => {
  beforeEach(() => {
    vi.mocked(getJob).mockReset();
  });

  it('returns job when owned by user', async () => {
    vi.mocked(getJob).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-1',
      type: 'classify',
      status: 'running',
      done: 2,
      total: 10,
    });
    const res = await request(app)
      .get('/api/inbox/jobs/job-1')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('job-1');
    expect(res.body.status).toBe('running');
  });

  it('returns 404 when job missing or owned by another user', async () => {
    vi.mocked(getJob).mockResolvedValue({
      id: 'job-1',
      user_id: 'other-user',
      type: 'classify',
      status: 'queued',
    });
    const res = await request(app)
      .get('/api/inbox/jobs/job-1')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/inbox/classify', () => {
  beforeEach(() => {
    vi.mocked(createJob).mockReset();
    vi.mocked(getActiveJob).mockReset().mockResolvedValue(null);
    vi.mocked(enqueueJob).mockReset().mockResolvedValue(undefined);
  });

  it('returns jobId for classify with forceRefresh payload', async () => {
    vi.mocked(createJob).mockImplementation(async ({ id, userId, type, payload }) => ({
      id,
      user_id: userId,
      type,
      payload,
      status: 'queued',
    }));
    const res = await request(app)
      .post('/api/inbox/classify')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true')
      .send({ forceRefresh: true });
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeTruthy();
    expect(res.body.reused).toBe(false);
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'classify',
        payload: { forceRefresh: true },
      })
    );
    expect(enqueueJob).toHaveBeenCalled();
  });

  it('does not expose classify-progress SSE route', async () => {
    const res = await request(app)
      .post('/api/inbox/classify-progress')
      .set('x-test-user', 'user-1')
      .set('x-gmail-connected', 'true');
    expect(res.status).toBe(404);
  });
});
