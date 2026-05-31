import {
  actionAuthToGovernanceActor,
  mapGovernanceEventToAuditAction,
  recordGovernanceAudit,
} from '@/lib/governance-audit';
import { mapTicketEventToAuditAction, recordTicketAudit } from '@/lib/ticket-audit';
import type { ActionAuthContext } from '@/lib/authz-context';

describe('audit dual-write helpers', () => {
  const actor: ActionAuthContext = {
    userId: '5',
    companyId: 1,
    companyIsSystem: true,
  };

  it('maps ticket event types to audit actions', () => {
    expect(mapTicketEventToAuditAction('payment_collected')).toBe(
      'payment_collected',
    );
    expect(mapTicketEventToAuditAction('unknown')).toBeNull();
  });

  it('maps governance event types to audit actions', () => {
    expect(mapGovernanceEventToAuditAction('export_generated')).toBe(
      'export_generated',
    );
  });

  it('dual-writes ticket audit rows', async () => {
    let insertCount = 0;
    const tx = {
      insert: () => ({
        values: async () => {
          insertCount += 1;
        },
      }),
    };

    await recordTicketAudit(
      tx as never,
      actor,
      BigInt(10),
      2,
      'created',
      { ticket: { id: '10' } },
    );

    expect(insertCount).toBe(2);
  });

  it('dual-writes governance audit rows', async () => {
    let insertCount = 0;
    const tx = {
      insert: () => ({
        values: async () => {
          insertCount += 1;
        },
      }),
    };

    await recordGovernanceAudit(tx as never, {
      actor: actionAuthToGovernanceActor(actor),
      resourceType: 'user',
      resourceId: 9,
      targetCompanyId: 2,
      eventType: 'created',
      after: { id: 9, name: 'New User' },
      source: 'api',
    });

    expect(insertCount).toBe(2);
  });
});
