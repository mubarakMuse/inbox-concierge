import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

vi.mock('../lib/storage.js', () => ({
  addBucket: vi.fn(),
}));
vi.mock('../middleware/userId.js', () => ({
  userIdFromCookie: (req, _res, next) => {
    req.userId = req.headers['x-test-user'] || 'default';
    next();
  },
}));

const { addBucket } = await import('../lib/storage.js');

describe('API', () => {
  it('GET /api/health returns 200 and storage type', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, storage: 'supabase' });
  });

  describe('POST /api/buckets', () => {
    beforeEach(() => {
      vi.mocked(addBucket).mockReset();
    });

    it('returns 400 when body has no name', async () => {
      const res = await request(app)
        .post('/api/buckets')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    it('returns 400 when name is over 50 chars', async () => {
      const res = await request(app)
        .post('/api/buckets')
        .set('Content-Type', 'application/json')
        .send({ name: 'a'.repeat(51) });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('50');
    });

    it('returns 201 when name is valid', async () => {
      vi.mocked(addBucket).mockResolvedValue({ id: 'new-bucket', name: 'New Bucket', is_default: false });
      const res = await request(app)
        .post('/api/buckets')
        .set('Content-Type', 'application/json')
        .send({ name: 'New Bucket' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Bucket');
    });
  });
});
