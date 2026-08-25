import crypto from 'node:crypto';
import { compare } from 'bcryptjs';

export const AGENT_TOKEN_PREFIX = 'zigzag_';

/** Chars stored in plaintext for O(1) lookup (includes prefix). */
export const AGENT_TOKEN_LOOKUP_LENGTH = 15;

const SHA256_HASH_PREFIX = 'sha256:';

export type GeneratedAgentToken = {
  token: string;
  keyPrefix: string;
};

export const generateAgentToken = (): GeneratedAgentToken => {
  const token = `${AGENT_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  return { token, keyPrefix: token.slice(0, AGENT_TOKEN_LOOKUP_LENGTH) };
};

export const hashAgentToken = (token: string): string =>
  `${SHA256_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;

export const isLegacyAgentTokenHash = (storedHash: string): boolean =>
  !storedHash.startsWith(SHA256_HASH_PREFIX);

export const verifyAgentToken = async (
  token: string,
  storedHash: string,
): Promise<boolean> => {
  if (isLegacyAgentTokenHash(storedHash)) {
    return compare(token, storedHash);
  }
  const expected = Buffer.from(storedHash.slice(SHA256_HASH_PREFIX.length), 'hex');
  const actual = crypto.createHash('sha256').update(token).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};
