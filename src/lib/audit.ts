import { auditEvent, type User } from '@/db/schema';
import type { db } from '@/lib/db';
import {
  assertAuditAction,
  assertAuditResourceType,
  assertAuditResult,
  assertAuditSource,
  type AuditAction,
  type AuditResourceType,
  type AuditResult,
  type AuditSource,
} from '@/lib/audit-catalog';

export type AuditActor = {
  userId: string;
  companyId: number | null;
  companyIsSystem: boolean;
};

export type AuditWriter = Pick<typeof db, 'insert'>;

const SENSITIVE_USER_KEYS = new Set(['password', 'remember_token']);

export const toAuditJson = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toAuditJson);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toAuditJson(entry)]),
    );
  }

  return value;
};

export const sanitizeUserForAudit = (
  row: User | null | undefined,
): Record<string, unknown> | null => {
  if (!row) {
    return null;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_USER_KEYS.has(key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
};

export const normalizeAuditResourceId = (
  resourceId: string | number | bigint | null | undefined,
): string | null => {
  if (resourceId === null || resourceId === undefined) {
    return null;
  }
  return resourceId.toString();
};

export const buildAuditPayload = (input: {
  actor?: AuditActor | null;
  targetCompanyId: number | null;
  before?: unknown;
  after?: unknown;
  extra?: Record<string, unknown>;
}): Record<string, unknown> => {
  const actor = input.actor;
  const crossCompany =
    Boolean(actor?.companyIsSystem) &&
    input.targetCompanyId !== null &&
    actor?.companyId !== null &&
    input.targetCompanyId !== actor?.companyId;

  return {
    before: input.before === undefined ? null : toAuditJson(input.before),
    after: input.after === undefined ? null : toAuditJson(input.after),
    cross_company: crossCompany,
    ...(actor
      ? {
          actor: {
            user_id: actor.userId,
            company_id: actor.companyId,
            company_is_system: actor.companyIsSystem,
          },
        }
      : {}),
    target_company_id: input.targetCompanyId,
    ...input.extra,
  };
};

export type RecordAuditEventInput = {
  actor?: AuditActor | null;
  targetCompanyId: number | null;
  resourceType: AuditResourceType;
  resourceId?: string | number | bigint | null;
  action: AuditAction;
  result: AuditResult;
  source: AuditSource;
  payload?: Record<string, unknown>;
  requestMeta?: Record<string, unknown>;
  occurredAt?: Date;
};

export const recordAuditEvent = async (
  tx: AuditWriter,
  input: RecordAuditEventInput,
): Promise<void> => {
  try {
    assertAuditResourceType(input.resourceType);
    assertAuditAction(input.action);
    assertAuditResult(input.result);
    assertAuditSource(input.source);

    const payload =
      input.payload === undefined
        ? null
        : (toAuditJson(input.payload) as Record<string, unknown>);

    const requestMeta =
      input.requestMeta === undefined
        ? null
        : (toAuditJson(input.requestMeta) as Record<string, unknown>);

    await tx.insert(auditEvent).values({
      occurred_at: input.occurredAt ?? new Date(),
      actor_user_id: input.actor?.userId ? BigInt(input.actor.userId) : null,
      actor_company_id: input.actor?.companyId ?? null,
      target_company_id: input.targetCompanyId,
      resource_type: input.resourceType,
      resource_id: normalizeAuditResourceId(input.resourceId),
      action: input.action,
      result: input.result,
      source: input.source,
      payload,
      request_meta: requestMeta,
    });
  } catch (error) {
    console.error('[audit][recordAuditEvent] failed to persist audit event', {
      resourceType: input.resourceType,
      action: input.action,
      result: input.result,
      error,
    });
  }
};
