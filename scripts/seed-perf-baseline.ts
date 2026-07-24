/**
 * Seed a dedicated perf-baseline tenant: 1k clients + 10k tickets (+ supporting rows).
 *
 * Idempotent for the company named `__perf_baseline__` — re-running replaces that
 * company's clients/tickets/services/audit rows without touching other tenants.
 *
 * Usage:
 *   npm run seed:perf
 *   PERF_CLIENTS=1000 PERF_TICKETS=10000 npm run seed:perf
 *
 * Prefer a disposable Neon branch (see docs/query-budget.md). Do not run against
 * production unless you intentionally want this tenant present.
 */
import 'dotenv/config';
import { eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import {
  auditEvent,
  client,
  company,
  service,
  ticket,
  ticketAuditEvent,
  user,
} from '../src/db/schema';

export const PERF_COMPANY_NAME = '__perf_baseline__';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const CLIENT_COUNT = Math.max(
  1,
  Number.parseInt(process.env.PERF_CLIENTS ?? '1000', 10) || 1000,
);
const TICKET_COUNT = Math.max(
  1,
  Number.parseInt(process.env.PERF_TICKETS ?? '10000', 10) || 10000,
);
const SERVICE_COUNT = Math.max(
  1,
  Number.parseInt(process.env.PERF_SERVICES ?? '25', 10) || 25,
);
const AUDIT_COUNT = Math.max(
  1,
  Number.parseInt(process.env.PERF_AUDITS ?? '2000', 10) || 2000,
);

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

const wipePerfCompanyData = async (companyId: number) => {
  const ticketIds = await db
    .select({ id: ticket.id })
    .from(ticket)
    .where(eq(ticket.company_id, companyId));

  if (ticketIds.length > 0) {
    const ids = ticketIds.map((row) => row.id);
    // Chunk deletes to keep statement size reasonable.
    const chunkSize = 2000;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await db
        .delete(ticketAuditEvent)
        .where(inArray(ticketAuditEvent.ticket_id, chunk));
    }
  }

  await db.delete(ticket).where(eq(ticket.company_id, companyId));
  await db.delete(client).where(eq(client.company_id, companyId));
  await db.delete(service).where(eq(service.company_id, companyId));
  await db
    .delete(auditEvent)
    .where(eq(auditEvent.target_company_id, companyId));
};

const ensurePerfCompany = async () => {
  const existing = await db.query.company.findFirst({
    where: eq(company.name, PERF_COMPANY_NAME),
  });
  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(company)
    .values({
      name: PERF_COMPANY_NAME,
      email: 'perf-baseline@zigzag.local',
      phone: '0000000000',
      street: 'Perf St',
      exterior_number: '1',
      neighborhood: 'Baseline',
      city: 'Perf City',
      state: 'Perf State',
      country: 'México',
      postal_code: '00000',
      is_system: false,
      status: 'ACTIVE',
      settings: {
        rfc: 'PERF000000XXX',
        default_currency: 'MXN',
        invoice_footer_note: 'query-budget perf baseline',
      },
    })
    .returning({ id: company.id });

  return created.id;
};

const pickActorUserId = async (): Promise<bigint | null> => {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.deleted_at} is null`)
    .limit(1);
  return row?.id ?? null;
};

async function main() {
  const started = Date.now();
  const companyId = await ensurePerfCompany();
  console.log(`Perf company id=${companyId} (${PERF_COMPANY_NAME})`);

  console.log('Wiping previous perf tenant rows…');
  await wipePerfCompanyData(companyId);

  console.log(`Inserting ${SERVICE_COUNT} services…`);
  await db.execute(sql`
    INSERT INTO "Service" (name, description, price, company_id, created_at)
    SELECT
      'Perf Service ' || g,
      'Synthetic service for query-budget baseline',
      (50 + (g % 40) * 25)::numeric(12,2),
      ${companyId},
      NOW() - ((g % 365) || ' days')::interval
    FROM generate_series(1, ${SERVICE_COUNT}) AS g
  `);

  console.log(`Inserting ${CLIENT_COUNT} clients…`);
  await db.execute(sql`
    INSERT INTO "Client" (name, email, phone, city, state, country, company_id, created_at)
    SELECT
      'Perf Client ' || g,
      'perf-client-' || g || '@example.test',
      lpad((1000000000 + g)::text, 10, '0'),
      'Perf City',
      'Perf State',
      'México',
      ${companyId},
      NOW() - ((g % 730) || ' days')::interval
    FROM generate_series(1, ${CLIENT_COUNT}) AS g
  `);

  console.log(`Inserting ${TICKET_COUNT} tickets…`);
  // Spread tickets across clients with varied finished/paid/created_at.
  // Use a numbered client CTE so each ticket maps via modulo (O(n), not OFFSET).
  await db.execute(sql`
    WITH numbered_clients AS (
      SELECT
        id,
        name,
        email,
        phone,
        row_number() OVER (ORDER BY id) - 1 AS idx
      FROM "Client"
      WHERE company_id = ${companyId} AND deleted_at IS NULL
    )
    INSERT INTO "Ticket" (
      client_id, client_name, client_tel, ticket_date, total, paid, email,
      finished, document, company_id, created_at
    )
    SELECT
      c.id,
      c.name,
      substring(coalesce(c.phone, '0000000000') from 1 for 10),
      NOW() - ((gs.g % 400) || ' days')::interval,
      (200 + (gs.g % 80) * 15)::numeric(12,2),
      CASE
        WHEN gs.g % 5 = 0 THEN (200 + (gs.g % 80) * 15)::numeric(12,2)
        WHEN gs.g % 5 = 1 THEN ((200 + (gs.g % 80) * 15) / 2)::numeric(12,2)
        ELSE 0::numeric(12,2)
      END,
      c.email,
      (gs.g % 5 = 0),
      'PERF-DOC-' || gs.g,
      ${companyId},
      NOW() - ((gs.g % 400) || ' days')::interval
    FROM generate_series(1, ${TICKET_COUNT}) AS gs(g)
    JOIN numbered_clients AS c
      ON c.idx = ((gs.g - 1) % ${CLIENT_COUNT})
  `);

  const actorUserId = await pickActorUserId();
  console.log(`Inserting ${AUDIT_COUNT} AuditEvent rows…`);
  await db.execute(sql`
    INSERT INTO "AuditEvent" (
      occurred_at, actor_user_id, actor_company_id, target_company_id,
      resource_type, resource_id, action, result, source, payload
    )
    SELECT
      NOW() - ((g % 200) || ' hours')::interval,
      ${actorUserId},
      ${companyId},
      ${companyId},
      CASE (g % 4)
        WHEN 0 THEN 'ticket'
        WHEN 1 THEN 'client'
        WHEN 2 THEN 'service'
        ELSE 'user'
      END,
      (g % ${TICKET_COUNT})::text,
      CASE (g % 5)
        WHEN 0 THEN 'created'
        WHEN 1 THEN 'updated'
        WHEN 2 THEN 'finished'
        WHEN 3 THEN 'payment_collected'
        ELSE 'generated'
      END,
      'success',
      'perf-baseline',
      jsonb_build_object('perf', true, 'n', g)
    FROM generate_series(1, ${AUDIT_COUNT}) AS g
  `);

  // Sample ticket audit history on the most recent 50 tickets.
  console.log('Inserting TicketAuditEvent samples…');
  await db.execute(sql`
    INSERT INTO "TicketAuditEvent" (
      ticket_id, company_id, actor_user_id, event_type, payload, created_at
    )
    SELECT
      t.id,
      ${companyId},
      ${actorUserId},
      CASE (gs.g % 3)
        WHEN 0 THEN 'created'
        WHEN 1 THEN 'payment_collected'
        ELSE 'finished'
      END,
      jsonb_build_object('perf', true),
      NOW() - ((gs.g % 48) || ' hours')::interval
    FROM (
      SELECT id FROM "Ticket"
      WHERE company_id = ${companyId} AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    ) AS t
    CROSS JOIN generate_series(1, 5) AS gs(g)
  `);

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM "Client" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS clients,
      (SELECT count(*) FROM "Service" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS services,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS tickets,
      (SELECT count(*) FROM "AuditEvent" WHERE target_company_id = ${companyId}) AS audits,
      (SELECT count(*) FROM "TicketAuditEvent" WHERE company_id = ${companyId}) AS ticket_audits
  `);

  const row = (counts as unknown as { rows?: Record<string, string>[] }).rows?.[0]
    ?? (Array.isArray(counts) ? (counts as Record<string, string>[])[0] : undefined);

  console.log('Perf baseline seed complete:', {
    companyId,
    companyName: PERF_COMPANY_NAME,
    ...(row ?? {}),
    elapsedMs: Date.now() - started,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
