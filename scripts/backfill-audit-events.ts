#!/usr/bin/env npx tsx
/**
 * One-time backfill of TicketAuditEvent and GovernanceAuditEvent into AuditEvent.
 * Safe to re-run: skips rows whose legacy id is already present in payload.
 *
 * Usage: npx tsx scripts/backfill-audit-events.ts [--dry-run]
 */
import { eq, sql } from 'drizzle-orm';
import {
  auditEvent,
  governanceAuditEvent,
  ticketAuditEvent,
} from '@/db/schema';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import type { AuditAction } from '@/lib/audit-catalog';

const dryRun = process.argv.includes('--dry-run');

const ticketActionMap: Record<string, AuditAction> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  finished: 'finished',
  payment_collected: 'payment_collected',
};

const governanceActionMap: Record<string, AuditAction> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  logo_uploaded: 'logo_uploaded',
  logo_removed: 'logo_removed',
  permissions_changed: 'permissions_changed',
  permission_assigned: 'permission_assigned',
  permission_removed: 'permission_removed',
  export_generated: 'export_generated',
  offboarded: 'offboarded',
};

const legacyExists = async (
  legacyTable: string,
  legacyId: number,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: auditEvent.id })
    .from(auditEvent)
    .where(
      sql`${auditEvent.payload}->'legacy'->>'table' = ${legacyTable} AND ${auditEvent.payload}->'legacy'->>'id' = ${String(legacyId)}`,
    )
    .limit(1);
  return Boolean(row);
};

const backfillTicketEvents = async (): Promise<number> => {
  const rows = await db.select().from(ticketAuditEvent);
  let inserted = 0;

  for (const row of rows) {
    const action = ticketActionMap[row.event_type];
    if (!action) {
      continue;
    }
    if (await legacyExists('TicketAuditEvent', row.id)) {
      continue;
    }

    if (dryRun) {
      inserted += 1;
      continue;
    }

    await recordAuditEvent(db, {
      actor: row.actor_user_id
        ? {
            userId: row.actor_user_id.toString(),
            companyId: row.company_id,
            companyIsSystem: false,
          }
        : null,
      targetCompanyId: row.company_id,
      resourceType: 'ticket',
      resourceId: row.ticket_id,
      action,
      result: 'success',
      source: 'action',
      payload: {
        ...(row.payload ?? {}),
        legacy: { table: 'TicketAuditEvent', id: row.id },
      },
      occurredAt: row.created_at,
    });
    inserted += 1;
  }

  return inserted;
};

const backfillGovernanceEvents = async (): Promise<number> => {
  const rows = await db.select().from(governanceAuditEvent);
  let inserted = 0;

  for (const row of rows) {
    const action = governanceActionMap[row.event_type];
    if (!action) {
      continue;
    }
    if (await legacyExists('GovernanceAuditEvent', row.id)) {
      continue;
    }

    if (dryRun) {
      inserted += 1;
      continue;
    }

    const resourceType = row.resource_type as
      | 'company'
      | 'user'
      | 'role'
      | 'permission';

    await recordAuditEvent(db, {
      actor: row.actor_user_id
        ? {
            userId: row.actor_user_id.toString(),
            companyId: row.actor_company_id,
            companyIsSystem: false,
          }
        : null,
      targetCompanyId: row.company_id,
      resourceType,
      resourceId: row.resource_id,
      action,
      result: 'success',
      source: 'action',
      payload: {
        ...(row.payload ?? {}),
        legacy: { table: 'GovernanceAuditEvent', id: row.id },
      },
      occurredAt: row.created_at,
    });
    inserted += 1;
  }

  return inserted;
};

const main = async () => {
  const ticketCount = await backfillTicketEvents();
  const governanceCount = await backfillGovernanceEvents();
  console.log(
    `${dryRun ? '[dry-run] would insert' : 'inserted'} ${ticketCount} ticket + ${governanceCount} governance audit rows`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    // drizzle/pg pool — process exit is fine for scripts
  });
