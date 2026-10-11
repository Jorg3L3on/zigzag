import { randomInt } from 'node:crypto';

/** No 0/o, 1/l/i or other look-alikes: the password is read aloud or typed from a chat. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUP_LENGTH = 4;

/**
 * Temporary password for someone who forgot theirs (ZIG-I18-11): two groups of
 * four, `kemo-7pdx`. They must replace it at their next login.
 */
export const generateTemporaryPassword = (): string => {
  const group = () =>
    Array.from({ length: GROUP_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}`;
};
