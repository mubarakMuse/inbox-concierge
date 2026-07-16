import { Router } from 'express';
import { getAuthUrl, setCredentialsFromCode, getAuthenticatedClient } from '../lib/auth.js';
import { getStoredTokens, clearTokens, deleteAllUserData } from '../lib/storage.js';
import { userIdFromCookie, setUserIdCookie, clearUserIdCookie } from '../middleware/userId.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimitAuth } from '../middleware/rateLimit.js';
import { logger } from '../lib/logger.js';

export const authRouter = Router();

authRouter.use(rateLimitAuth);

authRouter.get('/url', (_req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get('/callback', async (req, res) => {
  const { code } = req.query;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (!code) {
    return res.redirect(`${frontend}?auth=error`);
  }
  try {
    const { userId } = await setCredentialsFromCode(code);
    setUserIdCookie(res, userId);
    res.redirect(`${frontend}?auth=success`);
  } catch (err) {
    logger.error('Auth callback failed', err);
    res.redirect(`${frontend}?auth=error`);
  }
});

authRouter.get('/status', userIdFromCookie, async (req, res) => {
  try {
    if (!req.userId) {
      return res.json({ connected: false, hasTokens: false });
    }
    const client = await getAuthenticatedClient(req.userId);
    const tokens = await getStoredTokens(req.userId);
    res.json({ connected: !!client, hasTokens: !!tokens });
  } catch (err) {
    logger.error('Auth status failed', err);
    res.status(503).json({
      connected: false,
      hasTokens: false,
      error: err.message || 'Storage unavailable',
    });
  }
});

authRouter.post('/disconnect', userIdFromCookie, requireAuth, async (req, res) => {
  await clearTokens(req.userId);
  clearUserIdCookie(res);
  res.json({ ok: true });
});

authRouter.post('/delete-all-data', userIdFromCookie, requireAuth, async (req, res) => {
  try {
    await deleteAllUserData(req.userId);
    await clearTokens(req.userId);
    clearUserIdCookie(res);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Delete all data failed', err);
    res.status(500).json({ error: err.message || 'Failed to delete data' });
  }
});
