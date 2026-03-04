import { createHmac } from 'crypto';

const COOKIE_NAME = 'uid';
const SECRET = process.env.COOKIE_SECRET || 'inbox-concierge-dev-secret-change-in-production';

function sign(value) {
  return createHmac('sha256', SECRET).update(value).digest('hex').slice(0, 16);
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

// Sets req.userId from signed cookie, or 'default'.
export function userIdFromCookie(req, res, next) {
  const raw = parseCookieHeader(req.headers.cookie);
  if (!raw) {
    req.userId = 'default';
    return next();
  }
  const [payload, sig] = raw.includes('.') ? raw.split('.') : [raw, ''];
  let userId;
  try {
    userId = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    req.userId = 'default';
    return next();
  }
  if (!userId || sign(userId) !== sig) {
    req.userId = 'default';
    return next();
  }
  req.userId = userId;
  next();
}

// Signed cookie with user id. Use after OAuth callback.
export function setUserIdCookie(res, userId) {
  const payload = Buffer.from(userId, 'utf8').toString('base64url');
  const sig = sign(userId);
  const value = `${payload}.${sig}`;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  const isCrossOrigin = process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost');
  const sameSite = isCrossOrigin ? 'None' : 'Lax';
  const secure = isCrossOrigin ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=${sameSite}${secure}`,
  ].join(''));
}

// Clear cookie on disconnect.
export function clearUserIdCookie(res) {
  const isCrossOrigin = process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost');
  const sameSite = isCrossOrigin ? 'None' : 'Lax';
  const secure = isCrossOrigin ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure}`);
}
