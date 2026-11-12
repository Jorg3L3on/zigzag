import { and, count, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { auditEvent, user, type CompanyLifecycleStatus } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildOperatorSecurityAlert,
  OPERATOR_ALERT_LOOKBACK_DAYS,
  SIGN_IN_BURST_THRESHOLD,
  SIGN_IN_BURST_WINDOW_MINUTES,
  type OperatorSecurityAlert,
  type SignInBurst,
} from '@/lib/operator-sign-in-burst';

/**
 * Bounded per-company reads for the operator console (ZIG-I38, audit E11–E13).
 * Every query is keyed by company ids and, for the audit log, by a time window
 * or the (target_company_id, occurred_at) index. None selects `payload` or
 * searches its text.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const lookbackStart = (now: Date): Date =>
  new Date(now.getTime() - OPERATOR_ALERT_LOOKBACK_DAYS * DAY_MS);

export const loadPeopleCountByCompany = async (
  companyIds: number[],
): Promise<Map<number, number>> => {
  const map = new Map<number, number>();
  if (companyIds.length === 0) return map;
  const rows = await db
    .select({ companyId: user.company_id, total: count() })
    .from(user)
    .where(and(inArray(user.company_id, companyIds), isNull(user.deleted_at)))
    .groupBy(user.company_id);
  for (const row of rows) {
    if (row.companyId != null) map.set(row.companyId, Number(row.total));
  }
  return map;
};

/** Last `signed_in` by a user that belongs to the company (actor_company_id). */
export const loadLastSignInByCompany = async (
  companyIds: number[],
): Promise<Map<number, Date>> => {
  const map = new Map<number, Date>();
  if (companyIds.length === 0) return map;
  const rows = await db
    .select({
      companyId: auditEvent.actor_company_id,
      at: max(auditEvent.occurred_at),
    })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.action, 'signed_in'),
        inArray(auditEvent.actor_company_id, companyIds),
      ),
    )
    .groupBy(auditEvent.actor_company_id);
  for (const row of rows) {
    if (row.companyId != null && row.at) map.set(row.companyId, row.at);
  }
  return map;
};

type BurstRow = {
  company_id: number;
  account: string;
  at: Date | string;
  n: number | string;
};

/**
 * Failed sign-ins carry no company, so they are matched to a company through
 * the account email (`resource_id`) of a user of that company. A window
 * function counts failures per account in the trailing 15 minutes; only the
 * last 7 days are scanned.
 */
export const loadSignInBurstsByCompany = async (
  companyIds: number[],
  now: Date = new Date(),
): Promise<Map<number, SignInBurst>> => {
  const map = new Map<number, SignInBurst>();
  if (companyIds.length === 0) return map;
  const windowSql = sql.raw(`interval '${Number(SIGN_IN_BURST_WINDOW_MINUTES)} minutes'`);
  const result = await db.execute(sql`
    select company_id, account, max(occurred_at) as at, max(n) as n
    from (
      select u.company_id, e.resource_id as account, e.occurred_at,
        count(*) over (
          partition by e.resource_id
          order by e.occurred_at
          range between ${windowSql} preceding and current row
        ) as n
      from ${auditEvent} e
      join ${user} u on u.email = e.resource_id and u.deleted_at is null
      where e.action = 'sign_in_failed'
        and e.occurred_at >= ${lookbackStart(now)}
        and u.company_id in (${sql.join(
          companyIds.map((id) => sql`${id}`),
          sql`, `,
        )})
    ) w
    where n >= ${SIGN_IN_BURST_THRESHOLD}
    group by company_id, account
  `);
  for (const row of result.rows as BurstRow[]) {
    const at = new Date(row.at);
    const current = map.get(row.company_id);
    if (!current || at > current.at) {
      map.set(row.company_id, {
        account: row.account,
        at,
        count: Number(row.n),
      });
    }
  }
  return map;
};

export const loadPermissionDeniedByCompany = async (
  companyIds: number[],
  now: Date = new Date(),
): Promise<Map<number, { at: Date; account: string | null; count: number }>> => {
  const map = new Map<number, { at: Date; account: string | null; count: number }>();
  if (companyIds.length === 0) return map;
  const rows = await db
    .select({
      companyId: auditEvent.target_company_id,
      at: max(auditEvent.occurred_at),
      total: count(),
    })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.action, 'permission_denied'),
        inArray(auditEvent.target_company_id, companyIds),
        sql`${auditEvent.occurred_at} >= ${lookbackStart(now)}`,
      ),
    )
    .groupBy(auditEvent.target_company_id);
  for (const row of rows) {
    if (row.companyId != null && row.at) {
      map.set(row.companyId, { at: row.at, account: null, count: Number(row.total) });
    }
  }
  return map;
};

export const loadSecurityAlertsByCompany = async (
  companyIds: number[],
  now: Date = new Date(),
): Promise<Map<number, OperatorSecurityAlert>> => {
  const [bursts, denied] = await Promise.all([
    loadSignInBurstsByCompany(companyIds, now),
    loadPermissionDeniedByCompany(companyIds, now),
  ]);
  const map = new Map<number, OperatorSecurityAlert>();
  for (const id of companyIds) {
    const alert = buildOperatorSecurityAlert({
      burst: bursts.get(id) ?? null,
      permissionDenied: denied.get(id) ?? null,
      now,
    });
    if (alert) map.set(id, alert);
  }
  return map;
};

/**
 * When each company entered its current status: the latest company audit
 * event whose `after.status` equals it. Uses a jsonb path in the filter only.
 */
export const loadStatusSinceByCompany = async (
  companies: { id: number; status: CompanyLifecycleStatus }[],
): Promise<Map<number, Date>> => {
  const map = new Map<number, Date>();
  const relevant = companies.filter((row) => row.status !== 'SETUP');
  if (relevant.length === 0) return map;
  const pairs = sql.join(
    relevant.map((row) => sql`(${row.id}::int, ${row.status}::text)`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select e.target_company_id as company_id, max(e.occurred_at) as at
    from ${auditEvent} e
    join (values ${pairs}) as c(id, status) on c.id = e.target_company_id
    where e.resource_type = 'company'
      and e.action in ('updated', 'offboarded')
      and e.payload -> 'after' ->> 'status' = c.status
      and coalesce(e.payload -> 'before' ->> 'status', '') <> c.status
    group by e.target_company_id
  `);
  for (const row of result.rows as { company_id: number; at: Date | string }[]) {
    if (row.at) map.set(row.company_id, new Date(row.at));
  }
  return map;
};

/** Users of the company with no `signed_in` event at all («Nunca ha entrado»). */
export const loadNeverSignedInCount = async (companyId: number): Promise<number> => {
  const result = await db.execute(sql`
    select count(*)::int as total
    from ${user} u
    where u.company_id = ${companyId}
      and u.deleted_at is null
      and not exists (
        select 1 from ${auditEvent} e
        where e.actor_user_id = u.id and e.action = 'signed_in'
      )
  `);
  return Number((result.rows[0] as { total?: number } | undefined)?.total ?? 0);
};
