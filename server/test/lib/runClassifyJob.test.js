import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/auth.js', () => ({
  getAuthenticatedClient: vi.fn(),
}));
vi.mock('../../lib/gmail.js', () => ({
  fetchThreads: vi.fn(),
}));
vi.mock('../../lib/classification.js', () => ({
  classifyAll: vi.fn(),
}));
vi.mock('../../lib/storage.js', () => ({
  getJob: vi.fn(),
  updateJob: vi.fn(),
  getThreadsCache: vi.fn(),
  saveThreadsCache: vi.fn(),
  saveClassifications: vi.fn(),
  getClassifications: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const { getAuthenticatedClient } = await import('../../lib/auth.js');
const { classifyAll } = await import('../../lib/classification.js');
const {
  getJob,
  updateJob,
  getThreadsCache,
  saveClassifications,
} = await import('../../lib/storage.js');
const { runClassifyJob } = await import('../../lib/runClassifyJob.js');

describe('runClassifyJob cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops and does not write classifications when job is cancelled mid-run', async () => {
    const threads = [
      { id: 't1', subject: 'A', snippet: '' },
      { id: 't2', subject: 'B', snippet: '' },
    ];

    vi.mocked(getJob)
      .mockResolvedValueOnce({
        id: 'job-1',
        user_id: 'user-1',
        type: 'recategorize',
        status: 'queued',
        payload: {},
      })
      .mockResolvedValueOnce({
        id: 'job-1',
        user_id: 'user-1',
        type: 'recategorize',
        status: 'running',
      })
      .mockResolvedValueOnce({
        id: 'job-1',
        user_id: 'user-1',
        type: 'recategorize',
        status: 'failed',
        error: 'Cancelled',
      });

    vi.mocked(getAuthenticatedClient).mockResolvedValue({ fake: true });
    vi.mocked(getThreadsCache).mockResolvedValue(threads);
    vi.mocked(updateJob).mockResolvedValue({});
    vi.mocked(classifyAll).mockImplementation(async (_threads, onProgress) => {
      await onProgress({ done: 1, total: 2, partial: { t1: { bucket_id: 'important', reason: 'x' } } });
      return { t1: { bucket_id: 'important', reason: 'x' } };
    });

    await runClassifyJob('job-1');

    expect(saveClassifications).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('does nothing when job is already failed', async () => {
    vi.mocked(getJob).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-1',
      type: 'classify',
      status: 'failed',
      error: 'Cancelled',
    });

    await runClassifyJob('job-1');

    expect(classifyAll).not.toHaveBeenCalled();
    expect(saveClassifications).not.toHaveBeenCalled();
  });
});
