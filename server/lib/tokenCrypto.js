import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || !String(raw).trim()) return null;
  const value = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  return createHash('sha256').update(value).digest();
}

export function isEncryptionEnabled() {
  return !!getKey();
}

/** Encrypt tokens object → enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64> */
export function encryptTokens(tokens) {
  const key = getKey();
  if (!key) return tokens;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(tokens), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypt enc:v1:... string, or return legacy plaintext object/string as-is. */
export function decryptTokens(stored) {
  if (stored == null) return null;
  if (typeof stored === 'object') return stored;
  if (typeof stored !== 'string') return stored;
  if (!stored.startsWith(PREFIX)) {
    try {
      return JSON.parse(stored);
    } catch {
      return stored;
    }
  }
  const key = getKey();
  if (!key) {
    throw new Error('Encrypted tokens found but TOKEN_ENCRYPTION_KEY is not set');
  }
  const rest = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = rest.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted token format');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
