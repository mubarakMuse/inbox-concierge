import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { userIdFromCookie } from './middleware/userId.js';
import { authRouter } from './routes/auth.js';
import { bucketsRouter } from './routes/buckets.js';
import { inboxRouter } from './routes/inbox.js';

import { logger } from './lib/logger.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(userIdFromCookie);

app.use('/api/auth', authRouter);
app.use('/api/buckets', bucketsRouter);
app.use('/api/inbox', inboxRouter);

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, storage: 'supabase' })
);

app.use((err, _req, res, _next) => {
  logger.error('Request error', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => logger.info('Server listening', { port: PORT }));
}
