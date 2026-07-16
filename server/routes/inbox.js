import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireGmailAuth } from '../middleware/requireGmailAuth.js';
import { rateLimitClassify } from '../middleware/rateLimit.js';
import {
  getBuckets,
  getClassifications,
  getThreadsCache,
  createJob,
  getJob,
} from '../lib/storage.js';
import { enqueueJob } from '../lib/queue.js';
import { loadJobDonePayload } from '../lib/runClassifyJob.js';
import { logger } from '../lib/logger.js';

export const inboxRouter = Router();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startJob(userId, type) {
  const id = randomUUID();
  const job = await createJob({ id, userId, type });
  await enqueueJob({ jobId: id, userId, type });
  return job;
}

inboxRouter.get('/buckets', async (req, res) => {
  try {
    const userId = req.userId || 'default';
    const buckets = await getBuckets(userId);
    const classifications = await getClassifications(userId);
    const counts = {};
    buckets.forEach((b) => (counts[b.id] = 0));
    Object.values(classifications).forEach((c) => {
      if (counts[c.bucket_id] !== undefined) counts[c.bucket_id]++;
    });
    res.json({ buckets, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

inboxRouter.get('/threads', requireGmailAuth, async (req, res) => {
  try {
    const userId = req.userId || 'default';
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
    const userId = req.userId || 'default';
    const job = await startJob(userId, 'classify');
    res.json({ jobId: job.id });
  } catch (err) {
    logger.error('Classify enqueue failed', err);
    res.status(500).json({ error: err.message || 'Failed to start classify job' });
  }
});

inboxRouter.post('/classify-progress', requireGmailAuth, rateLimitClassify, async (req, res) => {
  const userId = req.userId || 'default';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const writeEvent = (payload) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.flush?.();
  };

  try {
    const job = await startJob(userId, 'classify');
    let lastDone = -1;
    let lastTotal = -1;

    while (!closed) {
      const current = await getJob(job.id);
      if (!current) {
        writeEvent({ type: 'error', error: 'Job not found' });
        break;
      }

      if (current.done !== lastDone || current.total !== lastTotal) {
        lastDone = current.done;
        lastTotal = current.total;
        if (current.total > 0 || current.status === 'running') {
          writeEvent({ type: 'progress', done: current.done, total: current.total });
        }
      }

      if (current.status === 'completed') {
        const payload = await loadJobDonePayload(current);
        writeEvent({ type: 'done', threads: payload.threads, classifications: payload.classifications });
        break;
      }

      if (current.status === 'failed') {
        writeEvent({ type: 'error', error: current.error || 'Classification failed' });
        break;
      }

      await sleep(500);
    }
  } catch (err) {
    logger.error('Classify progress failed', err);
    writeEvent({ type: 'error', error: err.message });
  }

  if (!closed) res.end();
});

inboxRouter.get('/jobs/:jobId', async (req, res) => {
  try {
    const userId = req.userId || 'default';
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
    const userId = req.userId || 'default';
    const job = await startJob(userId, 'recategorize');
    res.json({ jobId: job.id });
  } catch (err) {
    logger.error('Recategorize enqueue failed', err);
    res.status(500).json({ error: err.message || 'Recategorization failed' });
  }
});
