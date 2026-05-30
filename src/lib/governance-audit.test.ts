import {
  actionAuthToGovernanceActor,
  buildGovernanceAuditPayload,
  sanitizeUserForAudit,
  toAuditJson,
} from '@/lib/governance-audit';
import type { ActionAuthContext } from '@/lib/authz-context';

describe('governance-audit', () => {
  it('serializes bigint and date values for audit payloads', () => {
    expect(toAuditJson(BigInt(42))).toBe('42');
    expect(toAuditJson(new Date('2026-01-15T00:00:00.000Z'))).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });

  it('strips sensitive user fields from audit snapshots', () => {
    const sanitized = sanitizeUserForAudit({
      id: BigInt(1),
      name: 'Owner',
      email: 'owner@example.com',
      password: 'secret',
      remember_token: 'token',
      company_id: 2,
      role_id: 3,
      email_verified_at: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: null,
      deleted_at: null,
    });

    expect(sanitized).toMatchObject({
      id: BigInt(1),
      name: 'Owner',
      email: 'owner@example.com',
      company_id: 2,
      role_id: 3,
    });
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('remember_token');
  });

  it('marks cross-company system-admin mutations in payload', () => {
    const actor: ActionAuthContext = {
      userId: '10',
      companyId: 1,
      companyIsSystem: true,
    };

    const payload = buildGovernanceAuditPayload({
      actor: actionAuthToGovernanceActor(actor),
      mutation: 'updated',
      targetCompanyId: 5,
      before: { status: 'SETUP' },
      after: { status: 'ACTIVE' },
    });

    expect(payload.cross_company).toBe(true);
    expect(payload.mutation).toBe('updated');
    expect(payload.before).toEqual({ status: 'SETUP' });
    expect(payload.after).toEqual({ status: 'ACTIVE' });
    expect(payload.actor).toEqual({
      user_id: '10',
      company_id: 1,
      company_is_system: true,
    });
  });
});
