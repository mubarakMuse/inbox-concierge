import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './api/index.js';

describe('api', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
  });

  describe('getAuthUrl', () => {
    it('returns url from response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://accounts.google.com/...' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      const url = await api.getAuthUrl();
      expect(url).toBe('https://accounts.google.com/...');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/url'));
    });

    it('throws when response not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Missing client id' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await expect(api.getAuthUrl()).rejects.toThrow();
    });
  });

  describe('getAuthStatus', () => {
    it('returns status with credentials', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ connected: true, hasTokens: true }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      const status = await api.getAuthStatus();
      expect(status).toEqual({ connected: true, hasTokens: true });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/status'), { credentials: 'include' });
    });
  });

  describe('disconnect', () => {
    it('succeeds when ok', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true });
      await expect(api.disconnect()).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/disconnect'), expect.objectContaining({ method: 'POST' }));
    });

    it('throws when not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false });
      await expect(api.disconnect()).rejects.toThrow('Failed to disconnect');
    });
  });

  describe('getBucketsWithCounts', () => {
    it('returns buckets and counts', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ buckets: [{ id: 'important', name: 'Important' }], counts: { important: 5 } }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      const data = await api.getBucketsWithCounts();
      expect(data.buckets).toHaveLength(1);
      expect(data.counts.important).toBe(5);
    });

    it('throws with message when not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await expect(api.getBucketsWithCounts()).rejects.toThrow('Server error');
    });
  });

  describe('getThreads', () => {
    it('calls without bucket_id', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ threads: [], classifications: {} }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await api.getThreads();
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/inbox\/threads$/), expect.any(Object));
    });

    it('appends bucket_id query when provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ threads: [] }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await api.getThreads('important');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('bucket_id=important'), expect.any(Object));
    });
  });

  describe('createBucket', () => {
    it('sends name in body and returns bucket', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'my-bucket', name: 'My Bucket', is_default: false }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      const bucket = await api.createBucket('My Bucket');
      expect(bucket.name).toBe('My Bucket');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/buckets'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Bucket' }),
        })
      );
    });

    it('throws when not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Bucket already exists' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await expect(api.createBucket('Dup')).rejects.toThrow('Bucket already exists');
    });
  });

  describe('deleteBucket', () => {
    it('calls DELETE with encoded id', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await api.deleteBucket('my-bucket');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/buckets/my-bucket'), expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('recategorize', () => {
    it('starts job then polls until completed', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-1' }),
          headers: new Headers({ 'content-type': 'application/json' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'job-1',
              status: 'completed',
              done: 1,
              total: 1,
              result: { classifications: { t1: { bucket_id: 'important', reason: 'x' } } },
            }),
          headers: new Headers({ 'content-type': 'application/json' }),
        });
      const data = await api.recategorize();
      expect(data.classifications).toEqual({ t1: { bucket_id: 'important', reason: 'x' } });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/inbox/recategorize'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/inbox/jobs/job-1'),
        expect.anything()
      );
    });
  });

  describe('deleteAllMyData', () => {
    it('succeeds when ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await expect(api.deleteAllMyData()).resolves.toBeDefined();
    });

    it('throws with error message when not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot delete' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
      await expect(api.deleteAllMyData()).rejects.toThrow('Cannot delete');
    });
  });
});
