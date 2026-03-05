import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userIdFromCookie, setUserIdCookie, clearUserIdCookie } from '../../middleware/userId.js';

describe('userIdFromCookie', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('sets req.userId to "default" when no cookie', () => {
    const req = { headers: {} };
    const res = {};
    let nextCalled = false;
    userIdFromCookie(req, res, () => { nextCalled = true; });
    expect(req.userId).toBe('default');
    expect(nextCalled).toBe(true);
  });

  it('sets req.userId to "default" when cookie header is empty string', () => {
    const req = { headers: { cookie: '' } };
    const res = {};
    userIdFromCookie(req, res, () => {});
    expect(req.userId).toBe('default');
  });

  it('sets req.userId to "default" when cookie has wrong name', () => {
    const req = { headers: { cookie: 'other=foo' } };
    const res = {};
    userIdFromCookie(req, res, () => {});
    expect(req.userId).toBe('default');
  });

  it('sets req.userId to "default" when payload is invalid base64url', () => {
    const req = { headers: { cookie: 'uid=not-valid-base64!!.somesig' } };
    const res = {};
    userIdFromCookie(req, res, () => {});
    expect(req.userId).toBe('default');
  });
});

describe('setUserIdCookie', () => {
  it('sets Set-Cookie header with encoded payload and signature', () => {
    const res = { setHeader: vi.fn() };
    setUserIdCookie(res, 'user-123');
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.any(String));
    const call = res.setHeader.mock.calls[0][1];
    expect(call).toContain('uid=');
    expect(call).toContain('Path=/');
    expect(call).toContain('Max-Age=');
    expect(call).toContain('HttpOnly');
  });
});

describe('clearUserIdCookie', () => {
  it('sets Set-Cookie header to clear cookie', () => {
    const res = { setHeader: vi.fn() };
    clearUserIdCookie(res);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'));
  });
});
