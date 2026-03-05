import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

vi.mock('../../lib/storage.js', () => ({
  addBucket: vi.fn(),
  removeBucket: vi.fn(),
  getClassifications: vi.fn(),
  saveClassifications: vi.fn(),
}));
vi.mock('../../middleware/userId.js', () => ({
  userIdFromCookie: (req, _res, next) => {
    req.userId = req.headers['x-test-user'] || 'default';
    next();
  },
}));

const { addBucket, removeBucket, getClassifications, saveClassifications } = await import('../../lib/storage.js');

describe('POST /api/buckets', () => {
  beforeEach(() => {
    vi.mocked(addBucket).mockReset();
  });

  it('returns 201 and bucket when name is valid', async () => {
    vi.mocked(addBucket).mockResolvedValue({ id: 'my-bucket', name: 'My Bucket', is_default: false });
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .set('x-test-user', 'user-1')
      .send({ name: 'My Bucket' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'my-bucket', name: 'My Bucket', is_default: false });
    expect(addBucket).toHaveBeenCalledWith('My Bucket', 'user-1');
  });

  it('trims bucket name', async () => {
    vi.mocked(addBucket).mockResolvedValue({ id: 'trimmed', name: 'Trimmed', is_default: false });
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({ name: '  Trimmed  ' });
    expect(res.status).toBe(201);
    expect(addBucket).toHaveBeenCalledWith('Trimmed', 'default');
  });

  it('returns 400 when name is empty', async () => {
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('returns 400 when name is over 50 chars', async () => {
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({ name: 'a'.repeat(51) });
    expect(res.status).toBe(400);
    expect(addBucket).not.toHaveBeenCalled();
  });

  it('returns 409 when bucket already exists', async () => {
    vi.mocked(addBucket).mockRejectedValue(new Error('Bucket with this name already exists'));
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({ name: 'Important' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('returns 500 when storage throws generic error', async () => {
    vi.mocked(addBucket).mockRejectedValue(new Error('Database connection failed'));
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({ name: 'New' });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/buckets/:id', () => {
  beforeEach(() => {
    vi.mocked(removeBucket).mockReset();
    vi.mocked(getClassifications).mockResolvedValue({});
    vi.mocked(saveClassifications).mockResolvedValue(undefined);
  });

  it('returns 200 and ok when bucket removed', async () => {
    vi.mocked(removeBucket).mockResolvedValue({ removed: 'custom-bucket' });
    vi.mocked(getClassifications).mockResolvedValue({});
    const res = await request(app)
      .delete('/api/buckets/custom-bucket')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, movedToOther: false });
  });

  it('returns 404 when bucket not found', async () => {
    vi.mocked(removeBucket).mockRejectedValue(new Error('Bucket not found'));
    const res = await request(app).delete('/api/buckets/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Bucket not found');
  });

  it('returns 400 when cannot remove default bucket', async () => {
    vi.mocked(removeBucket).mockRejectedValue(new Error('Cannot remove default bucket'));
    const res = await request(app).delete('/api/buckets/important');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('default');
  });

  it('moves classifications to other when some were in deleted bucket', async () => {
    vi.mocked(removeBucket).mockResolvedValue({ removed: 'old-bucket' });
    vi.mocked(getClassifications).mockResolvedValue({
      thread1: { bucket_id: 'old-bucket', reason: 'x' },
      thread2: { bucket_id: 'other', reason: '' },
    });
    const res = await request(app)
      .delete('/api/buckets/old-bucket')
      .set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.movedToOther).toBe(true);
    expect(saveClassifications).toHaveBeenCalled();
  });
});
