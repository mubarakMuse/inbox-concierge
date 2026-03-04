import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const skipInTest = process.env.NODE_ENV === 'test';

export const rateLimitAuth = rateLimit({
  windowMs: WINDOW_MS,
  max: skipInTest ? 10000 : 30,
  message: { error: 'Too many auth attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimitClassify = rateLimit({
  windowMs: WINDOW_MS,
  max: skipInTest ? 10000 : 10,
  keyGenerator: (req) => req.userId || req.ip || 'anonymous',
  message: { error: 'Too many classify requests. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
