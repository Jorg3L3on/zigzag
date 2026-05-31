import { ticketAuditEvent } from '@/db/schema';
import type { ActionAuthContext } from '@/lib/authz-context';
import {
  buildAuditPayload,
  recordAuditEvent,
  toAuditJson,
  type AuditWriter,
} from '@/lib/audit';
import type { AuditAction } from '@/lib/audit-catalog';

const TICKET_AUDIT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'finished',
  'payment_collected',
] as const;

export type TicketAuditAction = (typeof TICKET_AUDIT_ACTIONS)[number];

const isTicketAuditAction = (value: string): value is TicketAuditAction =>
  (TICKET_AUDIT_ACTIONS as readonly string[]).includes(value);

export const mapTicketEventToAuditAction = (
  eventType: string,
): AuditAction | null => {
  if (!isTicketAuditAction(eventType)) {
    return null;
  }
  return eventType;
};

export const recordTicketAudit = async (
  tx: AuditWriter,
  context: ActionAuthContext,
  ticketId: bigint,
  companyId: number | null,
  eventType: TicketAuditAction,
  payload: Record<string, unknown>,
  source: 'action' | 'api' = 'action',
): Promise<void> => {
  const serializedPayload = toAuditJson(payload) as Record<string, unknown>;

  await tx.insert(ticketAuditEvent).values({
    ticket_id: ticketId,
    company_id: companyId,
    actor_user_id: BigInt(context.userId),
    event_type: eventType,
    payload: serializedPayload,
  });

  const action = mapTicketEventToAuditAction(eventType);
  if (!action) {
    return;
  }

  await recordAuditEvent(tx, {
    actor: {
      userId: context.userId,
      companyId: context.companyId,
      companyIsSystem: context.companyIsSystem,
    },
    targetCompanyId: companyId,
    resourceType: 'ticket',
    resourceId: ticketId,
    action,
    result: 'success',
    source,
    payload: buildAuditPayload({
      actor: {
        userId: context.userId,
        companyId: context.companyId,
        companyIsSystem: context.companyIsSystem,
      },
      targetCompanyId: companyId,
      extra: serializedPayload,
    }),
  });
};
