import { createHmac, randomBytes } from 'node:crypto';

/**
 * Dependency-free RFC 6238 TOTP (SHA1, 6 digits, 30s step) with Base32 secrets.
 * Compatible with Google Authenticator, 1Password, Authy, etc.
 */

export const TOTP_ISSUER = 'ZigZag';
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (input: string): Buffer => {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const hotp = (secret: Buffer, counter: number): string => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
};

export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

/** Generate the current TOTP code (exposed mainly for tests). */
export const generateTotp = (
  secret: string,
  forTime: number = Date.now(),
): string => {
  const counter = Math.floor(forTime / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secret), counter);
};

export const buildOtpAuthUri = (secret: string, accountName: string): string => {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

/** Verify a token, allowing +/- one 30s step for clock drift. */
export const verifyTotp = (token: string, secret: string): boolean => {
  if (!token || !secret) {
    return false;
  }
  const clean = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) {
    return false;
  }
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let window = -1; window <= 1; window += 1) {
    if (hotp(key, counter + window) === clean) {
      return true;
    }
  }
  return false;
};
