/**
 * @jest-environment node
 *
 * Needs a migrated Postgres (migration 0032). Skipped unless FOLIO_DB_TEST=1:
 *   FOLIO_DB_TEST=1 npx jest src/lib/folio-allocator.db.test.ts
 */
import { eq, inArray } from 'drizzle-orm';
import { company, documentFolioCounter, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { allocateDocumentFolio } from '@/lib/folio-allocator';
import { backfillMissingFolios } from '@/lib/folio-backfill';

const enabled = process.env.FOLIO_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

describeDb('allocateDocumentFolio (real Postgres)', () => {
  const suffix = `${Date.now()}`;
  const companyIds: number[] = [];

  const createCompany = async (
    label: string,
    settings: Record<string, string> | null = null,
  ) => {
    const [row] = await db
      .insert(company)
      .values({ name: `Folio test ${label} ${suffix}`, phone: "5550000000", email: `folio-${suffix}@test.local`, street: "x", exterior_number: "1", neighborhood: "x", city: "x", state: "x", country: "MX", postal_code: "00000", settings })
      .returning({ id: company.id });
    companyIds.push(row.id);
    return row.id;
  };

  const createTicket = async (companyId: number, kind: 'ticket' | 'presupuesto') =>
    db.transaction(async (tx) => {
      const folio = await allocateDocumentFolio(tx, { companyId, documentKind: kind });
      const [row] = await tx
        .insert(ticket)
        .values({ company_id: companyId, document_kind: kind, client_name: 'Prueba', ...folio })
        .returning();
      return row;
    });

  afterAll(async () => {
    if (companyIds.length > 0) {
      await db.delete(ticket).where(inArray(ticket.company_id, companyIds));
      await db
        .delete(documentFolioCounter)
        .where(inArray(documentFolioCounter.company_id, companyIds));
      await db.delete(company).where(inArray(company.id, companyIds));
    }
  });

  it('never repeats a number when many documents are created at once', async () => {
    const companyId = await createCompany('concurrent');
    const rows = await Promise.all(
      Array.from({ length: 25 }, () => createTicket(companyId, 'ticket')),
    );
    const numbers = rows.map((row) => row.folio_number).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(new Set(rows.map((row) => row.folio_prefix))).toEqual(new Set(['R']));
  });

  it('keeps presupuestos and tickets in separate series per company', async () => {
    const a = await createCompany('series-a');
    const b = await createCompany('series-b');
    const p1 = await createTicket(a, 'presupuesto');
    const r1 = await createTicket(a, 'ticket');
    const p2 = await createTicket(a, 'presupuesto');
    const otherCompany = await createTicket(b, 'ticket');
    expect([p1.folio_number, p1.folio_prefix]).toEqual([1, 'P']);
    expect([r1.folio_number, r1.folio_prefix]).toEqual([1, 'R']);
    expect([p2.folio_number, p2.folio_prefix]).toEqual([2, 'P']);
    expect([otherCompany.folio_number, otherCompany.folio_prefix]).toEqual([1, 'R']);
  });

  it('hands the number back when the creating transaction rolls back', async () => {
    const companyId = await createCompany('rollback');
    await createTicket(companyId, 'ticket');
    await expect(
      db.transaction(async (tx) => {
        await allocateDocumentFolio(tx, { companyId, documentKind: 'ticket' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const next = await createTicket(companyId, 'ticket');
    expect(next.folio_number).toBe(2);
  });

  it('uses the configured prefix for new documents only', async () => {
    const companyId = await createCompany('prefix');
    const before = await createTicket(companyId, 'ticket');
    await db
      .update(company)
      .set({ settings: { folio_prefix_ticket: 'rec', folio_prefix_presupuesto: 'cot' } })
      .where(eq(company.id, companyId));
    const after = await createTicket(companyId, 'ticket');
    const quote = await createTicket(companyId, 'presupuesto');
    expect(before.folio_prefix).toBe('R');
    expect([after.folio_prefix, after.folio_number]).toEqual(['REC', 2]);
    expect([quote.folio_prefix, quote.folio_number]).toEqual(['COT', 1]);
  });

  it('refuses a duplicate folio in the same company and kind', async () => {
    const companyId = await createCompany('unique');
    await createTicket(companyId, 'ticket');
    await expect(
      db.insert(ticket).values({
        company_id: companyId,
        document_kind: 'ticket',
        folio_number: 1,
        folio_prefix: 'R',
      }),
    ).rejects.toThrow();
  });

  it('backfills rows that have no folio after the highest number', async () => {
    const companyId = await createCompany('backfill');
    await createTicket(companyId, 'ticket');
    await db.insert(ticket).values([
      { company_id: companyId, document_kind: 'ticket', client_name: 'Sin folio 1' },
      { company_id: companyId, document_kind: 'presupuesto', client_name: 'Sin folio 2' },
    ]);
    await backfillMissingFolios(db);
    const rows = await db.select().from(ticket).where(eq(ticket.company_id, companyId));
    const byName = Object.fromEntries(rows.map((row) => [row.client_name, row]));
    expect(byName['Sin folio 1'].folio_number).toBe(2);
    expect(byName['Sin folio 2'].folio_number).toBe(1);
    expect(byName['Sin folio 2'].folio_prefix).toBe('P');
    const next = await createTicket(companyId, 'ticket');
    expect(next.folio_number).toBe(3);
  });
});
