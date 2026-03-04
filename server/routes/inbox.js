import { Router } from 'express';
import { requireGmailAuth } from '../middleware/requireGmailAuth.js';
import { rateLimitClassify } from '../middleware/rateLimit.js';
import { fetchThreads } from '../lib/gmail.js';
import { classifyAll } from '../lib/classification.js';
import {
  getBuckets,
  getClassifications,
  saveClassifications,
  getThreadsCache,
  saveThreadsCache,
} from '../lib/storage.js';
import { logger } from '../lib/logger.js';

export const inboxRouter = Router();

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

inboxRouter.post('/classify-progress', requireGmailAuth, rateLimitClassify, async (req, res) => {
  const userId = req.userId || 'default';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    let threads = await getThreadsCache(userId);
    if (!threads || threads.length === 0) {
      threads = await fetchThreads(200, req.gmailAuth);
      await saveThreadsCache(threads, userId);
    }
    if (threads.length === 0) {
      await saveClassifications({}, userId);
      res.write(`data: ${JSON.stringify({ type: 'done', threads: [], classifications: {} })}\n\n`);
      res.end();
      return;
    }
    const classifications = await classifyAll(threads, (progress) => {
      if (progress.partial) {
        saveClassifications(progress.partial, userId).catch((e) => logger.error('Save partial classifications', e));
      }
      res.write(`data: ${JSON.stringify({ type: 'progress', done: progress.done, total: progress.total })}\n\n`);
      res.flush?.();
    }, userId);
    await saveClassifications(classifications, userId);
    const withReasons = threads.map((t) => ({ ...t, reason: classifications[t.id]?.reason }));
    res.write(`data: ${JSON.stringify({ type: 'done', threads: withReasons, classifications })}\n\n`);
  } catch (err) {
    logger.error('Classify progress failed', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
  }
  res.end();
});

inboxRouter.post('/recategorize', requireGmailAuth, rateLimitClassify, async (req, res) => {
  try {
    const userId = req.userId || 'default';
    const threads = await getThreadsCache(userId);
    if (!threads || threads.length === 0) {
      return res.status(400).json({ error: 'No threads to recategorize. Fetch emails first.' });
    }
    const classifications = await classifyAll(threads, null, userId);
    await saveClassifications(classifications, userId);
    res.json({ classifications, progress: { done: threads.length, total: threads.length } });
  } catch (err) {
    logger.error('Recategorize failed', err);
    res.status(500).json({ error: err.message || 'Recategorization failed' });
  }
});
