import { getAuthenticatedClient } from '../lib/auth.js';

export async function requireGmailAuth(req, res, next) {
  const userId = req.userId || 'default';
  const client = await getAuthenticatedClient(userId);
  if (!client) {
    return res.status(401).json({ error: 'Gmail not connected. Please connect your account.' });
  }
  req.gmailAuth = client;
  next();
}
