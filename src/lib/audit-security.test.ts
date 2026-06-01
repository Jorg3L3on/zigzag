const mockInsertValues = jest.fn(async () => undefined);

jest.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: mockInsertValues,
    }),
  },
}));

import { recordAuthAuditEvent, recordPermissionDeniedAudit } from '@/lib/audit-security';

describe('audit-security helpers', () => {
  beforeEach(() => {
    mockInsertValues.mockClear();
  });

  it('records permission denied without throwing', async () => {
    await expect(
      recordPermissionDeniedAudit({
        actor: {
          userId: '1',
          companyId: 2,
          companyIsSystem: false,
        },
        targetCompanyId: 2,
        permission: 'clients.write',
        source: 'api',
        reason: 'invalid_company_context',
        actorCompanyId: 2,
        requestedCompanyId: 99,
        requestMeta: { route: '/api/clients', method: 'POST' },
      }),
    ).resolves.toBeUndefined();

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'security',
        action: 'permission_denied',
        result: 'denied',
        source: 'api',
        payload: expect.objectContaining({
          permission: 'clients.write',
          error_code: 'AU002',
          denial_reason: 'invalid_company_context',
          actor_company_id: 2,
          requested_company_id: 99,
        }),
        request_meta: { route: '/api/clients', method: 'POST' },
      }),
    );
  });

  it('records auth failure without throwing', async () => {
    await expect(
      recordAuthAuditEvent({
        action: 'sign_in_failed',
        result: 'failed',
        email: 'user@example.com',
        reason: 'invalid_credentials',
      }),
    ).resolves.toBeUndefined();
  });
});
