/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateMigrations, findRisks, formatViolations, hasApproval } from './migration-safety.cjs';

const migration = (name: string) => readFileSync(join(__dirname, '..', 'drizzle', name), 'utf8');
const rules = (sql: string) => findRisks(sql).map((r: { rule: string }) => r.rule);

describe('findRisks on real migrations', () => {
  it('passes the additive 0028 (nullable column, new columns, check constraint)', () => {
    expect(findRisks(migration('0028_adhoc_service_lines.sql'))).toEqual([]);
  });

  it('flags the dropped Company.plan_id in 0022', () => {
    expect(rules(migration('0022_drop_plan_catalog.sql'))).toContain('DROP COLUMN');
  });

  it('flags the dropped two-factor columns in 0021', () => {
    expect(rules(migration('0021_drop_user_two_factor.sql'))).toEqual(['DROP COLUMN']);
  });

  it('flags the money type change in 0010', () => {
    expect(rules(migration('0010_money_numeric.sql'))).toContain('ALTER COLUMN ... TYPE');
  });

  it('flags the data backfill and drop in 0003', () => {
    expect(rules(migration('0003_company_status_ticket_audit.sql'))).toEqual(
      expect.arrayContaining(['UPDATE ... SET', 'DROP COLUMN']),
    );
  });

  it('does not treat ON UPDATE/ON DELETE foreign key actions as data changes', () => {
    expect(findRisks(migration('0004_rbac_foreign_keys.sql'))).toEqual([]);
    expect(findRisks(migration('0008_governance_audit.sql'))).toEqual([]);
  });
});

describe('findRisks', () => {
  it.each([
    ['DROP TABLE "Ticket";', 'DROP TABLE'],
    ['drop table if exists foo cascade;', 'DROP TABLE'],
    ['ALTER TABLE "X" DROP COLUMN "y";', 'DROP COLUMN'],
    ['DROP SCHEMA audit CASCADE;', 'DROP SCHEMA'],
    ['TRUNCATE "AuditEvent";', 'TRUNCATE'],
    ['DELETE FROM "Ticket" WHERE id = 1;', 'DELETE FROM'],
    ['UPDATE "Ticket" SET total = 0;', 'UPDATE ... SET'],
    ['ALTER TABLE "T" ALTER COLUMN "p" SET DATA TYPE integer;', 'ALTER COLUMN ... TYPE'],
    ['ALTER TABLE "T" ALTER COLUMN "p" TYPE text;', 'ALTER COLUMN ... TYPE'],
  ])('flags %s', (sql, rule) => {
    expect(rules(sql)).toEqual([rule]);
  });

  it('flags statements inside DO $$ blocks', () => {
    expect(rules('DO $$ BEGIN\n  DELETE FROM "T";\nEND $$;')).toEqual(['DELETE FROM']);
  });

  it('ignores comments and string literals', () => {
    const sql = [
      '-- DROP TABLE "Ticket";',
      '/* TRUNCATE "AuditEvent"; */',
      "COMMENT ON TABLE \"T\" IS 'we never DELETE FROM here';",
      'ALTER TABLE "T" ADD COLUMN "n" text;',
    ].join('\n');
    expect(findRisks(sql)).toEqual([]);
  });

  it('allows additive and index/constraint changes', () => {
    const sql = [
      'ALTER TABLE "T" ADD COLUMN IF NOT EXISTS "n" text;',
      'ALTER TABLE "T" ALTER COLUMN "n" DROP NOT NULL;',
      'DROP INDEX IF EXISTS "T_n_idx";',
      'ALTER TABLE "T" DROP CONSTRAINT "T_n_chk";',
      'CREATE INDEX "T_m_idx" ON "T" ("m");',
    ].join('\n');
    expect(findRisks(sql)).toEqual([]);
  });

  it('reports the line of the statement', () => {
    const [risk] = findRisks('ALTER TABLE "T" ADD COLUMN "a" text;\n--> statement-breakpoint\nDROP TABLE "Old";');
    expect(risk).toMatchObject({ rule: 'DROP TABLE', line: 3 });
  });
});

describe('approval and evaluation', () => {
  it('needs a data-loss-ok line with a reason', () => {
    expect(hasApproval('-- data-loss-ok: column unused since #400, backup taken\nDROP TABLE "A";')).toBe(true);
    expect(hasApproval('-- data-loss-ok:\nDROP TABLE "A";')).toBe(false);
    expect(hasApproval('DROP TABLE "A"; -- data-loss-ok: nope, not at line start')).toBe(false);
    expect(hasApproval('DROP TABLE "A";')).toBe(false);
  });

  it('fails unapproved risky files, passes approved and clean ones', () => {
    const { violations, approved } = evaluateMigrations([
      { path: 'drizzle/0100_bad.sql', sql: 'DROP TABLE "A";' },
      { path: 'drizzle/0101_ok.sql', sql: '-- data-loss-ok: table is empty in prod\nDROP TABLE "B";' },
      { path: 'drizzle/0102_clean.sql', sql: 'ALTER TABLE "C" ADD COLUMN "n" text;' },
    ]);
    expect(violations.map((v: { path: string }) => v.path)).toEqual(['drizzle/0100_bad.sql']);
    expect(approved).toEqual(['drizzle/0101_ok.sql']);
  });

  it('prints the file, line, rule and how to approve', () => {
    const { violations } = evaluateMigrations([{ path: 'drizzle/0100_bad.sql', sql: 'DROP TABLE "A";' }]);
    const text = formatViolations(violations);
    expect(text).toContain('drizzle/0100_bad.sql');
    expect(text).toContain('line 1: DROP TABLE');
    expect(text).toContain('-- data-loss-ok: <reason>');
  });
});
