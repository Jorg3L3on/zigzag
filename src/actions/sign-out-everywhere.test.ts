import { beforeEach, describe, expect, it } from '@jest/globals';

const mockRequireActionAuth = jest.fn();
const mockBump = jest.fn();
const mockAudit = jest.fn();
const mockRateLimit = jest.fn();

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/lib/security', () => ({
  requireActionAuth: () => mockRequireActionAuth(),
  requireActionPermission: jest.fn(),
}));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(),
  recordGovernanceAudit: jest.fn(),
  sanitizeUserForAudit: jest.fn(),
}));
jest.mock('@/lib/team-guards', () => ({ keepsATeamManager: jest.fn() }));
jest.mock('@/lib/session-revocation', () => ({
  bumpUserTokenVersion: (...a: unknown[]) => mockBump(...a),
}));
jest.mock('@/lib/audit-security', () => ({
  recordAuthAuditEvent: (...a: unknown[]) => mockAudit(...a),
}));
jest.mock('@/lib/audit-request-meta', () => ({
  buildAuditRequestMetaFromHeaders: jest.fn(async () => ({ route: '/account' })),
}));
jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...a: unknown[]) => mockRateLimit(...a),
}));

import { signOutEverywhere } from '@/actions/users';

describe('signOutEverywhere (ZIG-I17-9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireActionAuth.mockResolvedValue({
      userId: '7',
      companyId: 3,
      companyIsSystem: false,
    });
    mockRateLimit.mockResolvedValue(true);
  });

  it('bumps the token version of the signed-in user and records an audit event', async () => {
    const result = await signOutEverywhere();
    expect(result).toEqual({ success: true });
    expect(mockBump).toHaveBeenCalledWith(7n);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'signed_out',
        reason: 'sign_out_everywhere',
        actor: { userId: '7', companyId: 3, companyIsSystem: false },
      }),
    );
  });

  it('is rate limited per user and revokes nothing when throttled', async () => {
    mockRateLimit.mockResolvedValue(false);
    const result = await signOutEverywhere();
    expect(result.success).toBe(false);
    expect(mockRateLimit).toHaveBeenCalledWith(
      'sign-out-everywhere:7',
      expect.objectContaining({ limit: 5 }),
    );
    expect(mockBump).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('refuses a request with no session', async () => {
    mockRequireActionAuth.mockRejectedValue(new Error('Authentication required'));
    const result = await signOutEverywhere();
    expect(result.success).toBe(false);
    expect(mockBump).not.toHaveBeenCalled();
  });
});
