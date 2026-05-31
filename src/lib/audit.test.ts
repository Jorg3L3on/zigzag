import {
  assertAuditAction,
  assertAuditResourceType,
  assertAuditResult,
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';
import {
  buildAuditPayload,
  normalizeAuditResourceId,
  recordAuditEvent,
  sanitizeUserForAudit,
  toAuditJson,
} from '@/lib/audit';

describe('audit-catalog', () => {
  it('accepts known resource types, actions, and results', () => {
    expect(assertAuditResourceType('ticket')).toBe('ticket');
    expect(assertAuditAction('created')).toBe('created');
    expect(assertAuditResult('success')).toBe('success');
  });

  it('rejects unknown catalog values', () => {
    expect(() => assertAuditResourceType('unknown')).toThrow(
      'Invalid audit resource type',
    );
    expect(() => assertAuditAction('unknown')).toThrow('Invalid audit action');
    expect(() => assertAuditResult('unknown')).toThrow('Invalid audit result');
  });

  it('exports closed lists for documentation and validation', () => {
    expect(AUDIT_RESOURCE_TYPES).toContain('security');
    expect(AUDIT_ACTIONS).toContain('permission_denied');
    expect(AUDIT_RESULTS).toEqual(['success', 'denied', 'failed']);
  });
});

describe('audit recorder helpers', () => {
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
    const payload = buildAuditPayload({
      actor: {
        userId: '10',
        companyId: 1,
        companyIsSystem: true,
      },
      targetCompanyId: 5,
      before: { status: 'SETUP' },
      after: { status: 'ACTIVE' },
    });

    expect(payload.cross_company).toBe(true);
    expect(payload.before).toEqual({ status: 'SETUP' });
    expect(payload.after).toEqual({ status: 'ACTIVE' });
    expect(payload.actor).toEqual({
      user_id: '10',
      company_id: 1,
      company_is_system: true,
    });
  });

  it('normalizes resource ids to strings', () => {
    expect(normalizeAuditResourceId(BigInt(99))).toBe('99');
    expect(normalizeAuditResourceId(null)).toBeNull();
  });
});

describe('recordAuditEvent', () => {
  it('inserts a normalized audit row', async () => {
    const values: Record<string, unknown>[] = [];
    const tx = {
      insert: () => ({
        values: async (row: Record<string, unknown>) => {
          values.push(row);
        },
      }),
    };

    await recordAuditEvent(tx, {
      actor: {
        userId: '7',
        companyId: 1,
        companyIsSystem: true,
      },
      targetCompanyId: 2,
      resourceType: 'ticket',
      resourceId: BigInt(100),
      action: 'created',
      result: 'success',
      source: 'action',
      payload: { ticket_id: BigInt(100) },
      requestMeta: { route: '/dashboard/tickets' },
    });

    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      actor_user_id: BigInt(7),
      actor_company_id: 1,
      target_company_id: 2,
      resource_type: 'ticket',
      resource_id: '100',
      action: 'created',
      result: 'success',
      source: 'action',
      payload: { ticket_id: '100' },
      request_meta: { route: '/dashboard/tickets' },
    });
  });

  it('does not throw when catalog validation fails', async () => {
    const tx = {
      insert: () => ({
        values: async () => {
          throw new Error('should not insert');
        },
      }),
    };

    await expect(
      recordAuditEvent(tx, {
        targetCompanyId: null,
        resourceType: 'not-real' as 'ticket',
        action: 'created',
        result: 'success',
        source: 'action',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when insert fails', async () => {
    const tx = {
      insert: () => ({
        values: async () => {
          throw new Error('db down');
        },
      }),
    };

    await expect(
      recordAuditEvent(tx, {
        targetCompanyId: 1,
        resourceType: 'ticket',
        action: 'created',
        result: 'success',
        source: 'action',
      }),
    ).resolves.toBeUndefined();
  });
});
