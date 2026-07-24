/**
 * Run EXPLAIN (ANALYZE, BUFFERS) on tenant list query shapes and flag Seq Scans.
 *
 * Prerequisites:
 *   1. Migrations applied (incl. 0023_query_audit_active_indexes)
 *   2. `npm run seed:perf` so company `__perf_baseline__` has ~10k tickets / 1k clients
 *
 * Usage:
 *   npm run query:audit
 *   npm run query:audit -- --json > /tmp/query-audit.json
 */
import 'dotenv/config';
import { Pool } from 'pg';

const PERF_COMPANY_NAME = '__perf_baseline__';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

/** Acceptable execution-time budgets (ms) for the 10k/1k baseline. See docs/query-budget.md. */
const BUDGETS_MS = {
  'tickets.list': 150,
  'tickets.paginated': 80,
  'tickets.count': 80,
  'clients.list': 100,
  'clients.paginated': 60,
  'services.list': 40,
  'users.list': 40,
  'audit.events': 60,
  'ticket.audit-history': 40,
};

const asJson = process.argv.includes('--json');

const pool = new Pool({ connectionString });

const explain = async (label, sqlText, params = []) => {
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlText}`;
  const result = await pool.query(explainSql, params);
  const plan = result.rows[0]['QUERY PLAN'][0];
  const planText = JSON.stringify(plan);
  const hasSeqScan = /"Node Type"\s*:\s*"Seq Scan"/.test(planText);
  // Ignore InitPlan seq scans on tiny helper subqueries by checking the root
  // relation names we care about.
  const seqScanRelations = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) {
      seqScanRelations.push(node['Relation Name']);
    }
    for (const child of node.Plans ?? []) {
      walk(child);
    }
  };
  walk(plan.Plan);

  const executionMs = plan['Execution Time'];
  const budgetMs = BUDGETS_MS[label];
  const withinBudget = budgetMs == null ? true : executionMs <= budgetMs;

  return {
    label,
    executionMs,
    planningMs: plan['Planning Time'],
    budgetMs: budgetMs ?? null,
    withinBudget,
    hasSeqScan,
    seqScanRelations,
    // Prefer index access methods on tenant tables.
    usesIndex:
      /"Node Type"\s*:\s*"(Index Scan|Index Only Scan|Bitmap Index Scan|Bitmap Heap Scan)"/.test(
        planText,
      ),
    planSummary: summarizePlan(plan.Plan),
  };
};

const summarizePlan = (node, depth = 0) => {
  if (!node) return '';
  const indent = '  '.repeat(depth);
  const rel = node['Relation Name'] ? ` on ${node['Relation Name']}` : '';
  const idx = node['Index Name'] ? ` using ${node['Index Name']}` : '';
  const line = `${indent}${node['Node Type']}${rel}${idx} (actual ${node['Actual Total Time']} ms, rows=${node['Actual Rows']})`;
  const children = (node.Plans ?? []).map((child) => summarizePlan(child, depth + 1));
  return [line, ...children].join('\n');
};

async function main() {
  const companyRes = await pool.query(
    `SELECT id FROM "Company" WHERE name = $1 LIMIT 1`,
    [PERF_COMPANY_NAME],
  );
  const companyId = companyRes.rows[0]?.id;
  if (!companyId) {
    throw new Error(
      `Perf company "${PERF_COMPANY_NAME}" not found. Run: npm run seed:perf`,
    );
  }

  const counts = await pool.query(
    `SELECT
      (SELECT count(*)::int FROM "Ticket" WHERE company_id = $1 AND deleted_at IS NULL) AS tickets,
      (SELECT count(*)::int FROM "Client" WHERE company_id = $1 AND deleted_at IS NULL) AS clients,
      (SELECT count(*)::int FROM "Service" WHERE company_id = $1 AND deleted_at IS NULL) AS services,
      (SELECT count(*)::int FROM "User" WHERE company_id = $1 AND deleted_at IS NULL) AS users,
      (SELECT count(*)::int FROM "AuditEvent" WHERE target_company_id = $1) AS audits`,
    [companyId],
  );

  const ticketSample = await pool.query(
    `SELECT id FROM "Ticket" WHERE company_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [companyId],
  );
  const sampleTicketId = ticketSample.rows[0]?.id;

  // Warm caches once before measuring.
  await pool.query(
    `SELECT count(*) FROM "Ticket" WHERE company_id = $1 AND deleted_at IS NULL`,
    [companyId],
  );

  const queries = [
    [
      'tickets.list',
      `SELECT * FROM "Ticket"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId],
    ],
    [
      'tickets.paginated',
      `SELECT * FROM "Ticket"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 20 OFFSET 0`,
      [companyId],
    ],
    [
      'tickets.count',
      `SELECT count(*) FROM "Ticket"
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId],
    ],
    [
      'clients.list',
      `SELECT * FROM "Client"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId],
    ],
    [
      'clients.paginated',
      `SELECT * FROM "Client"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 20 OFFSET 0`,
      [companyId],
    ],
    [
      'services.list',
      `SELECT * FROM "Service"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId],
    ],
    [
      'users.list',
      `SELECT * FROM "User"
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId],
    ],
    [
      'audit.events',
      `SELECT * FROM "AuditEvent"
       WHERE target_company_id = $1
       ORDER BY occurred_at DESC, id DESC
       LIMIT 51`,
      [companyId],
    ],
    sampleTicketId
      ? [
          'ticket.audit-history',
          `SELECT * FROM "TicketAuditEvent"
           WHERE ticket_id = $1
           ORDER BY created_at DESC`,
          [sampleTicketId],
        ]
      : null,
  ].filter(Boolean);

  const results = [];
  for (const [label, sqlText, params] of queries) {
    results.push(await explain(label, sqlText, params));
  }

  // Tenant tables that should not Seq Scan under the list predicates.
  const tenantTables = new Set([
    'Ticket',
    'Client',
    'Service',
    'User',
    'AuditEvent',
    'TicketAuditEvent',
  ]);

  // Tiny catalogs (services / users per tenant) often fit in one heap page;
  // Postgres correctly prefers Seq Scan. Only fail when a tenant table Seq Scan
  // returns enough rows that an index would matter at baseline scale.
  const SEQ_SCAN_FAIL_ROWS = 200;

  const failures = results.filter((row) => {
    const badSeq = row.seqScanRelations.some((rel) => tenantTables.has(rel));
    // Re-check actual rows from plan summary when seq scan is present.
    const largeSeq =
      badSeq &&
      row.planSummary
        .split('\n')
        .some(
          (line) =>
            line.includes('Seq Scan') &&
            /rows=(\d+)/.test(line) &&
            Number(line.match(/rows=(\d+)/)?.[1] ?? 0) >= SEQ_SCAN_FAIL_ROWS,
        );
    return largeSeq || !row.withinBudget;
  });

  const report = {
    recordedAt: new Date().toISOString(),
    companyId,
    companyName: PERF_COMPANY_NAME,
    dataset: counts.rows[0],
    results,
    ok: failures.length === 0,
    failures: failures.map((row) => row.label),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`# Query audit — company ${companyId} (${PERF_COMPANY_NAME})`);
    console.log(`Dataset: ${JSON.stringify(counts.rows[0])}`);
    console.log('');
    for (const row of results) {
      const largeSeq = row.seqScanRelations.some((rel) => tenantTables.has(rel)) &&
        row.planSummary
          .split('\n')
          .some(
            (line) =>
              line.includes('Seq Scan') &&
              /rows=(\d+)/.test(line) &&
              Number(line.match(/rows=(\d+)/)?.[1] ?? 0) >= SEQ_SCAN_FAIL_ROWS,
          );
      const status = largeSeq
        ? 'SEQ SCAN'
        : row.withinBudget
          ? 'OK'
          : 'OVER BUDGET';
      console.log(
        `${status.padEnd(11)} ${row.label.padEnd(22)} ${row.executionMs.toFixed(2)} ms` +
          (row.budgetMs != null ? ` / budget ${row.budgetMs} ms` : '') +
          (row.seqScanRelations.length
            ? `  seq=[${row.seqScanRelations.join(',')}]`
            : ''),
      );
      console.log(row.planSummary);
      console.log('');
    }
    console.log(report.ok ? 'All queries within budget and using indexes.' : `Failures: ${report.failures.join(', ')}`);
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
