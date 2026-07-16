import { getAuthenticatedClient } from './auth.js';
import { fetchThreads } from './gmail.js';
import { classifyAll } from './classification.js';
import {
  getJob,
  updateJob,
  getThreadsCache,
  saveThreadsCache,
  saveClassifications,
  getClassifications,
} from './storage.js';
import { logger } from './logger.js';

const TERMINAL = new Set(['completed', 'failed']);

export async function runClassifyJob(jobId) {
  const job = await getJob(jobId);
  if (!job) {
    logger.error('Classify job not found', null, { jobId });
    return;
  }
  if (TERMINAL.has(job.status)) {
    logger.info('Classify job already terminal', { jobId, status: job.status });
    return;
  }

  const userId = job.user_id;
  const type = job.type;

  try {
    await updateJob(jobId, { status: 'running' });

    const auth = await getAuthenticatedClient(userId);
    if (!auth) {
      throw new Error('Gmail not connected. Please connect your account.');
    }

    let threads;
    if (type === 'classify') {
      threads = await getThreadsCache(userId);
      if (!threads || threads.length === 0) {
        threads = await fetchThreads(200, auth);
        await saveThreadsCache(threads, userId);
      }
      if (threads.length === 0) {
        await saveClassifications({}, userId);
        await updateJob(jobId, {
          status: 'completed',
          done: 0,
          total: 0,
          result: { threads: [], classifications: {} },
        });
        logger.info('Classify job completed with empty inbox', { jobId, userId });
        return;
      }
    } else if (type === 'recategorize') {
      threads = await getThreadsCache(userId);
      if (!threads || threads.length === 0) {
        throw new Error('No threads to recategorize. Fetch emails first.');
      }
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }

    await updateJob(jobId, { total: threads.length, done: 0 });

    const classifications = await classifyAll(
      threads,
      (progress) => {
        if (progress.partial) {
          saveClassifications(progress.partial, userId).catch((e) =>
            logger.error('Save partial classifications', e, { jobId })
          );
        }
        updateJob(jobId, { done: progress.done, total: progress.total }).catch((e) =>
          logger.error('Update job progress', e, { jobId })
        );
      },
      userId
    );

    await saveClassifications(classifications, userId);
    const withReasons = threads.map((t) => ({
      ...t,
      reason: classifications[t.id]?.reason,
    }));

    await updateJob(jobId, {
      status: 'completed',
      done: threads.length,
      total: threads.length,
      result: { threads: withReasons, classifications },
    });
    logger.info('Classify job completed', { jobId, userId, type, total: threads.length });
  } catch (err) {
    logger.error('Classify job failed', err, { jobId, userId: job.user_id, type: job.type });
    await updateJob(jobId, {
      status: 'failed',
      error: err.message || 'Classification failed',
    }).catch((e) => logger.error('Failed to mark job failed', e, { jobId }));
  }
}

/** Load done payload for SSE clients when result is missing. */
export async function loadJobDonePayload(job) {
  if (job?.result?.threads && job?.result?.classifications) {
    return {
      threads: job.result.threads,
      classifications: job.result.classifications,
    };
  }
  const userId = job.user_id;
  const [threads, classifications] = await Promise.all([
    getThreadsCache(userId),
    getClassifications(userId),
  ]);
  const list = threads || [];
  const withReasons = list.map((t) => ({
    ...t,
    reason: classifications[t.id]?.reason,
  }));
  return { threads: withReasons, classifications: classifications || {} };
}
