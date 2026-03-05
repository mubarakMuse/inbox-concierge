import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

vi.mock('../../lib/auth.js', () => ({
  getAuthUrl: vi.fn(),
  setCredentialsFromCode: vi.fn(),
  getAuthenticatedClient: vi.fn(),
}));
vi.mock('../../lib/storage.js', () => ({
  getStoredTokens: vi.fn(),
  clearTokens: vi.fn(),
  deleteAllUserData: vi.fn(),
}));
vi.mock('../../middleware/userId.js', () => ({
  userIdFromCookie: (req, _res, next) => {
    req.userId = req.headers['x-test-user'] || 'user-1';
    next();
  },
  setUserIdCookie: vi.fn(),
  clearUserIdCookie: vi.fn(),
}));

const { getAuthUrl, setCredentialsFromCode, getAuthenticatedClient } = await import('../../lib/auth.js');
const { getStoredTokens, clearTokens, deleteAllUserData } = await import('../../lib/storage.js');
const { clearUserIdCookie } = await import('../../middleware/userId.js');

describe('GET /api/auth/url', () => {
  beforeEach(() => {
    vi.mocked(getAuthUrl).mockReset();
  });

  it('returns auth URL', async () => {
    vi.mocked(getAuthUrl).mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');
    const res = await request(app).get('/api/auth/url');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://accounts.google.com/o/oauth2/auth?...' });
  });

  it('returns 500 when getAuthUrl throws', async () => {
    vi.mocked(getAuthUrl).mockImplementation(() => {
      throw new Error('Missing GOOGLE_CLIENT_ID');
    });
    const res = await request(app).get('/api/auth/url');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Missing GOOGLE_CLIENT_ID');
  });
});

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.mocked(setCredentialsFromCode).mockReset();
  });

  it('redirects to frontend with auth=error when no code', async () => {
    const res = await request(app).get('/api/auth/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\?auth=error$/);
  });

  it('redirects to frontend with auth=success when code is valid', async () => {
    vi.mocked(setCredentialsFromCode).mockResolvedValue({ userId: 'user-1' });
    const res = await request(app).get('/api/auth/callback').query({ code: 'valid-code' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\?auth=success$/);
  });

  it('redirects with auth=error when setCredentialsFromCode throws', async () => {
    vi.mocked(setCredentialsFromCode).mockRejectedValue(new Error('Invalid code'));
    const res = await request(app).get('/api/auth/callback').query({ code: 'bad' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\?auth=error$/);
  });
});

describe('GET /api/auth/status', () => {
  beforeEach(() => {
    vi.mocked(getAuthenticatedClient).mockReset();
    vi.mocked(getStoredTokens).mockReset();
  });

  it('returns connected: true when client and tokens exist', async () => {
    vi.mocked(getAuthenticatedClient).mockResolvedValue({});
    vi.mocked(getStoredTokens).mockResolvedValue({ access_token: 'x' });
    const res = await request(app).get('/api/auth/status').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: true, hasTokens: true });
  });

  it('returns connected: false when no client', async () => {
    vi.mocked(getAuthenticatedClient).mockResolvedValue(null);
    vi.mocked(getStoredTokens).mockResolvedValue(null);
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, hasTokens: false });
  });
});

describe('POST /api/auth/disconnect', () => {
  beforeEach(() => {
    vi.mocked(clearTokens).mockResolvedValue(undefined);
    vi.mocked(clearUserIdCookie).mockImplementation(() => {});
  });

  it('returns ok and clears tokens', async () => {
    const res = await request(app).post('/api/auth/disconnect').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /api/auth/delete-all-data', () => {
  beforeEach(() => {
    vi.mocked(deleteAllUserData).mockResolvedValue(undefined);
    vi.mocked(clearTokens).mockResolvedValue(undefined);
  });

  it('returns ok on success', async () => {
    const res = await request(app).post('/api/auth/delete-all-data').set('x-test-user', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 500 when deleteAllUserData throws', async () => {
    vi.mocked(deleteAllUserData).mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/api/auth/delete-all-data').set('x-test-user', 'user-1');
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
