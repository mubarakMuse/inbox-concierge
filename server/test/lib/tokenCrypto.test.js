import { describe, it, expect, afterEach } from 'vitest';
import { encryptTokens, decryptTokens, isEncryptionEnabled } from '../../lib/tokenCrypto.js';

describe('tokenCrypto', () => {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = prev;
  });

  it('passes through plaintext when key unset', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(isEncryptionEnabled()).toBe(false);
    const tokens = { access_token: 'a', refresh_token: 'b' };
    expect(encryptTokens(tokens)).toEqual(tokens);
    expect(decryptTokens(tokens)).toEqual(tokens);
  });

  it('round-trips with hex key', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    const tokens = { access_token: 'a', refresh_token: 'b' };
    const enc = encryptTokens(tokens);
    expect(typeof enc).toBe('string');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptTokens(enc)).toEqual(tokens);
  });

  it('reads legacy plaintext objects', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'passphrase-for-tests';
    const legacy = { access_token: 'legacy' };
    expect(decryptTokens(legacy)).toEqual(legacy);
  });
});
