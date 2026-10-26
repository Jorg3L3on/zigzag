import { PgDialect } from 'drizzle-orm/pg-core';

import {
  presupuestoExpiresTodayCondition,
  presupuestoStatusCondition,
} from '@/lib/presupuestos-list-query';

const toSql = (fragment: Parameters<PgDialect['sqlToQuery']>[0]) =>
  new PgDialect().sqlToQuery(fragment);

describe('presupuestoStatusCondition (ZIG-I29-3)', () => {
  it('reads expires_at as UTC and compares its company day with today', () => {
    const query = toSql(presupuestoStatusCondition('vencido', '2026-10-25'));
    expect(query.sql).toContain('"canceled_at" IS NULL');
    expect(query.sql).toContain('"converted_to_ticket_id" IS NULL');
    expect(query.sql).toMatch(/\(\("Ticket"\."expires_at" AT TIME ZONE 'UTC'\) AT TIME ZONE \$\d+\)::date < \$\d+::date/);
    expect(query.params).toEqual(['America/Mexico_City', '2026-10-25']);
  });

  it('keeps the order of getPresupuestoStatus: canceled, then converted, then the date', () => {
    expect(toSql(presupuestoStatusCondition('cancelado', '2026-10-25')).sql).toBe(
      '"Ticket"."canceled_at" IS NOT NULL',
    );
    expect(toSql(presupuestoStatusCondition('convertido', '2026-10-25')).sql).toBe(
      '"Ticket"."canceled_at" IS NULL AND "Ticket"."converted_to_ticket_id" IS NOT NULL',
    );
    expect(toSql(presupuestoStatusCondition('abierto', '2026-10-25')).sql).toContain('AND NOT (');
  });

  it('counts the open ones that expire on the company day', () => {
    const query = toSql(presupuestoExpiresTodayCondition('2026-10-25'));
    expect(query.sql).toMatch(/::date = \$\d+::date$/);
    expect(query.params.at(-1)).toBe('2026-10-25');
  });
});
