import { beforeEach, describe, expect, it } from '@jest/globals';

const mockFindFirst = jest.fn();
jest.mock('@/lib/db', () => ({
  db: { query: { user: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } } },
}));

import { isSessionCurrent } from '@/lib/session-revocation';

describe('isSessionCurrent', () => {
  beforeEach(() => mockFindFirst.mockReset());

  it('is true while the token carries the current token_version', async () => {
    mockFindFirst.mockResolvedValue({ token_version: 3 });
    expect(await isSessionCurrent({ user: { id: '7', token_version: 3 } })).toBe(true);
  });

  it('is false once token_version was bumped (sign out everywhere, password change)', async () => {
    mockFindFirst.mockResolvedValue({ token_version: 4 });
    expect(await isSessionCurrent({ user: { id: '7', token_version: 3 } })).toBe(false);
  });

  it('is false for a deleted user, a missing session or a failing lookup', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    expect(await isSessionCurrent({ user: { id: '7', token_version: 0 } })).toBe(false);
    expect(await isSessionCurrent(null)).toBe(false);
    mockFindFirst.mockRejectedValue(new Error('db down'));
    expect(await isSessionCurrent({ user: { id: '7', token_version: 0 } })).toBe(false);
  });
});
