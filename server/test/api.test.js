import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('API', () => {
  it('GET /api/health returns 200 and storage type', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, storage: 'supabase' });
  });

  it('POST /api/buckets without name returns 400', async () => {
    const res = await request(app)
      .post('/api/buckets')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });
});
