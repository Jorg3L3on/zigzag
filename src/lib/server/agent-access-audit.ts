import { governanceAuditEvent } from '@/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Governance audit events for agent credentials (API keys and OAuth grants). */
export const AGENT_ACCESS_AUDIT_EVENTS = [
  'api_key.created',
  'api_key.revoked',
  'oauth.consent_granted',
  'oauth.grant_revoked',
  'oauth.refresh_reuse',
] as const;

export type AgentAccessAuditEvent = (typeof AGENT_ACCESS_AUDIT_EVENTS)[number];

const RESOURCE_TYPE: Record<AgentAccessAuditEvent, string> = {
  'api_key.created': 'api_key',
  'api_key.revoked': 'api_key',
  'oauth.consent_granted': 'oauth_client',
  'oauth.grant_revoked': 'oauth_grant',
  'oauth.refresh_reuse': 'oauth_grant',
};

/**
 * One GovernanceAuditEvent row per credential change. The user whose access
 * changed is the actor; `actorUserId` overrides it when someone else acted
 * (an admin resetting a password). Never throws: a failed audit write is logged
 * and must not undo a revocation.
 */
export const recordAgentAccessAudit = async (input: {
  event: AgentAccessAuditEvent;
  userId: bigint;
  resourceId: string | number;
  payload?: Record<string, unknown>;
  actorUserId?: bigint;
}): Promise<void> => {
  try {
    await db.insert(governanceAuditEvent).values({
      resource_type: RESOURCE_TYPE[input.event],
      resource_id: String(input.resourceId),
      company_id: null,
      actor_user_id: input.actorUserId ?? input.userId,
      actor_company_id: null,
      event_type: input.event,
      payload: { user_id: input.userId.toString(), ...input.payload },
    });
  } catch (error) {
    logger.error('agent access audit write failed', {
      event: input.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
