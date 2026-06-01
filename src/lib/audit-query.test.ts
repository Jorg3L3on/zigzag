import fs from 'fs';
import path from 'path';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
  },
}));

import {
  normalizeAuditEventFilters,
  normalizeAuditLimit,
} from '@/lib/audit-query';

describe('audit query helpers', () => {
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
});
