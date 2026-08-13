import fs from 'fs';
import path from 'path';

const selectMock = jest.fn();

jest.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

jest.mock('@/lib/audit-actor-names', () => ({
  resolveActorNames: jest.fn(async (ids: Array<string | null>) => {
    const map = new Map<string, string>();
    for (const id of ids) {
      if (id === '7') {
        map.set('7', 'Jorge');
      }
    }
    return map;
  }),
}));

import {
  buildAuditSearchCondition,
  normalizeAuditEventFilters,
  normalizeAuditExportLimit,
  normalizeAuditLimit,
  queryAuditEvents,
} from '@/lib/audit-query';

const chainFrom = (rows: unknown[]) => {
  const chain: {
    from: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(async () => rows),
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
};

describe('audit query helpers', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('normalizes supported combined filters without marking them invalid', () => {
    expect(
      normalizeAuditEventFilters({
        targetCompanyId: 2,
        actorUserId: '42',
        resourceType: 'ticket',
        resourceId: '100',
        action: 'updated',
        result: 'denied',
        from: new Date('2026-05-01T00:00:00.000Z'),
        to: new Date('2026-05-31T00:00:00.000Z'),
        cursor: 99,
        limit: 25,
      }),
    ).toMatchObject({
      targetCompanyId: 2,
      actorUserId: '42',
      resourceType: 'ticket',
      resourceId: '100',
      action: 'updated',
      result: 'denied',
      invalid: false,
    });
  });

  it('marks unsupported filters invalid instead of throwing or widening results', () => {
    expect(
      normalizeAuditEventFilters({
        actorUserId: 'not-a-user-id',
        resourceType: 'not-real',
      }).invalid,
    ).toBe(true);

    expect(
      normalizeAuditEventFilters({
        action: 'not-real',
      }).invalid,
    ).toBe(true);

    expect(
      normalizeAuditEventFilters({
        result: 'not-real',
      }).invalid,
    ).toBe(true);
  });

  it('clamps audit query limits to the supported page size range', () => {
    expect(normalizeAuditLimit(0)).toBe(1);
    expect(normalizeAuditLimit(25)).toBe(25);
    expect(normalizeAuditLimit(500)).toBe(100);
  });

  it('does not treat payload presence as a text-search match', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/audit-query.ts'),
      'utf8',
    );

    expect(source).not.toContain('isNotNull(auditEvent.payload)');
    expect(source).toContain('auditEvent.payload}::text ILIKE');
    expect(source).toContain('auditEvent.request_meta}::text ILIKE');
  });

  it('wires incidentsOnly into the filter pipeline', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/audit-query.ts'),
      'utf8',
    );

    expect(source).toContain('incidentsOnly?: boolean');
    expect(source).toContain('buildOperatorIncidentSqlCondition()');
  });

  it('enriches list items with actor and company display names', async () => {
    const eventRows = [
      {
        id: 10,
        occurred_at: new Date('2026-05-01T12:00:00.000Z'),
        actor_user_id: BigInt(7),
        actor_company_id: 2,
        target_company_id: 3,
        resource_type: 'auth',
        resource_id: '7',
        action: 'signed_in',
        result: 'success',
        source: 'auth',
        payload: { email: 'a@b.com' },
        request_meta: {},
      },
    ];

    selectMock
      .mockReturnValueOnce(chainFrom(eventRows))
      .mockReturnValueOnce(
        chainFrom([
          { id: 2, name: 'Actor Co' },
          { id: 3, name: 'Target Co' },
        ]),
      );

    const page = await queryAuditEvents({ limit: 50 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 10,
      actor_user_id: '7',
      actor_name: 'Jorge',
      actor_company_id: 2,
      actor_company_name: 'Actor Co',
      target_company_id: 3,
      target_company_name: 'Target Co',
      action: 'signed_in',
    });
    expect(page.nextCursor).toBeNull();
  });

  it('builds Spanish-aware search conditions for catalog labels', () => {
    const condition = buildAuditSearchCondition('Éxito');
    expect(condition).not.toBeNull();

    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/audit-query.ts'),
      'utf8',
    );
    expect(source).toContain('resolveAuditSearchCatalogMatches');
  });

  it('clamps export limits separately from page limits', () => {
    expect(normalizeAuditExportLimit(0)).toBe(1);
    expect(normalizeAuditExportLimit(2500)).toBe(2500);
    expect(normalizeAuditExportLimit(9000)).toBe(5000);
  });
});
