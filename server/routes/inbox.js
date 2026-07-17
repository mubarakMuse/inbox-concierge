import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGmailAuth } from '../middleware/requireGmailAuth.js';
import { rateLimitClassify } from '../middleware/rateLimit.js';
import {
  getBuckets,
  getClassifications,
  getThreadsCache,
  createJob,
  getJob,
  getActiveJob,
  updateThreadClassification,
  getLastSortedAt,
} from '../lib/storage.js';
import { enqueueJob } from '../lib/queue.js';
import { logger } from '../lib/logger.js';

export const inboxRouter = Router();

inboxRouter.use(requireAuth);

async function startJob(userId, type, payload = {}) {
  const existing = await getActiveJob(userId);
  if (existing) {
    return { job: existing, reused: true };
  }
  const id = randomUUID();
  const job = await createJob({ id, userId, type, payload });
  await enqueueJob({ jobId: id, userId, type });
  return { job, reused: false };
}

inboxRouter.get('/buckets', async (req, res) => {
  try {
    const userId = req.userId;
    const buckets = await getBuckets(userId);
    const classifications = await getClassifications(userId);
    const lastSortedAt = await getLastSortedAt(userId);
    const counts = {};
    buckets.forEach((b) => (counts[b.id] = 0));
    Object.values(classifications).forEach((c) => {
      if (counts[c.bucket_id] !== undefined) counts[c.bucket_id]++;
    });
    res.json({ buckets, counts, lastSortedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.patch('/threads/:threadId', async (req, res) => {
  try {
    const userId = req.userId;
    const { threadId } = req.params;
    const bucketId = req.body?.bucket_id;
    const reason = req.body?.reason;

    if (!threadId || typeof threadId !== 'string') {
      return res.status(400).json({ error: 'threadId is required' });
    }
    if (!bucketId || typeof bucketId !== 'string') {
      return res.status(400).json({ error: 'bucket_id is required' });
    }

    const buckets = await getBuckets(userId);
    const bucketExists = buckets.some((b) => b.id === bucketId);
    if (!bucketExists) {
      return res.status(400).json({ error: 'Bucket not found' });
    }

    const updated = await updateThreadClassification(threadId, bucketId, reason, userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.get('/threads', requireGmailAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { bucket_id } = req.query;
    const classifications = await getClassifications(userId);
    let threads = await getThreadsCache(userId);
    if (!threads || Object.keys(classifications).length === 0) {
      return res.json({ threads: [], needClassify: true });
    }
    const list = bucket_id
      ? Object.entries(classifications)
          .filter(([, c]) => c.bucket_id === bucket_id)
          .map(([threadId]) => threads.find((t) => t.id === threadId))
          .filter(Boolean)
      : threads;
    const withReason = list.map((t) => ({
      ...t,
      reason: classifications[t.id]?.reason,
    }));
    res.json({ threads: withReason, classifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.post('/classify', requireGmailAuth, rateLimitClassify, async (req, res) => {
  try {
    const userId = req.userId;
    const forceRefresh = !!req.body?.forceRefresh;
    const { job, reused } = await startJob(userId, 'classify', { forceRefresh });
    res.json({ jobId: job.id, reused });
  } catch (err) {
    logger.error('Classify enqueue failed', err);
    res.status(500).json({ error: err.message || 'Failed to start classify job' });
  }
});

inboxRouter.get('/jobs/active', async (req, res) => {
  try {
    const job = await getActiveJob(req.userId);
    res.json({ job: job ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.get('/jobs/:jobId', async (req, res) => {
  try {
    const userId = req.userId;
    const job = await getJob(req.params.jobId);
    if (!job || job.user_id !== userId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.post('/recategorize', requireGmailAuth, rateLimitClassify, async (req, res) => {
  try {
    const userId = req.userId;
    const { job, reused } = await startJob(userId, 'recategorize');
    res.json({ jobId: job.id, reused });
  } catch (err) {
    logger.error('Recategorize enqueue failed', err);
    res.status(500).json({ error: err.message || 'Recategorization failed' });
  }
});
