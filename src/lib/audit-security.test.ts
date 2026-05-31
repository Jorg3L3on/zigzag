jest.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: async () => undefined,
    }),
  },
}));

import { recordAuthAuditEvent, recordPermissionDeniedAudit } from '@/lib/audit-security';

describe('audit-security helpers', () => {
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
        requestMeta: { route: '/api/clients', method: 'POST' },
      }),
    ).resolves.toBeUndefined();
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
