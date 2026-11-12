/**
 * @jest-environment node
 *
 * Integration test on a real Postgres (ZIG-I23-3). Runs only when DATABASE_URL
 * points at this machine: jest loads `.env` (production Neon) and
 * `.env.test.local`, so put a disposable copy in the latter, e.g.
 *   createdb -p 5433 -T zigzag zigzag_scratch
 *   echo DATABASE_URL=postgresql://localhost:5433/zigzag_scratch > .env.test.local
 */
import { inArray } from 'drizzle-orm';
import {
  client,
  company,
  servicesTickets,
  ticket,
  ticketLineMaterial,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { loadDashboardDayQueueForCompany } from '@/lib/dashboard-day-queue-loader';
import { loadDashboardMetricsForCompany } from '@/lib/dashboard-metrics-loader';
import {
  getAgentCompanySummary,
  getAgentDocument,
  listAgentDocuments,
  type ListDocumentsInput,
} from '@/lib/mcp/domain/documents';
import {
  companySummaryOutputSchema,
  getDocumentOutputSchema,
  listDocumentsOutputSchema,
} from '@/lib/mcp/schemas';
import { toJsonSafe } from '@/lib/mcp/tool-helpers';
import { getTicketPaymentStatus } from '@/lib/ticket-payment-status';

// The readers take an already-resolved company; NextAuth (ESM) stays out of jest.
jest.mock('@/lib/server/resolve-agent-context', () => ({
  AgentAuthError: class AgentAuthError extends Error {},
}));

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const hasLocalTestDatabase = (): boolean => {
  try {
    return LOCAL_DB_HOSTS.has(new URL(process.env.DATABASE_URL ?? '').hostname);
  } catch {
    return false;
  }
};

const describeDb = hasLocalTestDatabase() ? describe : describe.skip;

const ISSUER = 'https://zigzag.test';
const SUMMARY_DATE = '2026-10-10';

describeDb('MCP document readers (real Postgres)', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyIds: number[] = [];
  const userIds: bigint[] = [];
  const ids: Record<string, bigint> = {};
  let companyA = 0;
  let companyB = 0;
  let clientAna = 0;

  const createCompany = async (label: string) => {
    const [row] = await db
      .insert(company)
      .values({
        name: `MCP docs ${label} ${stamp}`,
        phone: '5550000000',
        email: `docs-${label}-${stamp}@company.test.local`,
        street: 'x',
        exterior_number: '1',
        neighborhood: 'x',
        city: 'x',
        state: 'x',
        country: 'MX',
        postal_code: '00000',
      })
      .returning({ id: company.id });
    companyIds.push(row.id);
    return row.id;
  };

  type DocSeed = {
    key: string;
    companyId: number;
    kind?: 'ticket' | 'presupuesto';
    clientId?: number | null;
    clientName: string;
    date: string;
    createdAt: string;
    total: number | null;
    paid?: number;
    finished?: boolean;
    folio: number;
    prefix?: string;
    deleted?: boolean;
    canceled?: boolean;
    convertedFrom?: string;
    userId?: bigint;
  };

  const seedDoc = async (seed: DocSeed) => {
    const kind = seed.kind ?? 'ticket';
    const [row] = await db
      .insert(ticket)
      .values({
        company_id: seed.companyId,
        document_kind: kind,
        client_id: seed.clientId ?? null,
        client_name: seed.clientName,
        client_tel: kind === 'ticket' ? '5512345678' : null,
        ticket_date: new Date(seed.date),
        created_at: new Date(seed.createdAt),
        total: seed.total,
        paid: seed.paid ?? 0,
        finished: seed.finished ?? false,
        folio_number: seed.folio,
        folio_prefix: seed.prefix ?? (kind === 'presupuesto' ? 'P' : 'R'),
        deleted_at: seed.deleted ? new Date() : null,
        canceled_at: seed.canceled ? new Date() : null,
        converted_from_ticket_id: seed.convertedFrom ? ids[seed.convertedFrom] : null,
        userId: seed.userId ?? null,
        work_notes: seed.key === 'withLines' ? 'Revisar la fuga del baño' : null,
      })
      .returning({ id: ticket.id });
    ids[seed.key] = row.id;
    return row.id;
  };

  beforeAll(async () => {
    companyA = await createCompany('a');
    companyB = await createCompany('b');

    const [author] = await db
      .insert(user)
      .values({
        name: 'Técnico Uno',
        email: `docs-${stamp}@user.test.local`,
        password: 'not-a-login',
        company_id: companyA,
      })
      .returning({ id: user.id });
    userIds.push(author.id);

    const [ana] = await db
      .insert(client)
      .values({
        name: 'Ana López',
        phone: '5511112222',
        email: 'ana@cliente.test',
        street: 'Av. Juárez',
        exterior_number: '10',
        neighborhood: 'Centro',
        city: 'Puebla',
        company_id: companyA,
      })
      .returning({ id: client.id });
    clientAna = ana.id;
    const [bruno] = await db
      .insert(client)
      .values({ name: 'Bruno Díaz', company_id: companyA })
      .returning({ id: client.id });
    const [anaB] = await db
      .insert(client)
      .values({ name: 'Ana Otra Compañía', company_id: companyB })
      .returning({ id: client.id });

    // Company A. created_at gives the list order (newest first).
    await seedDoc({ key: 'overdue', companyId: companyA, clientId: ana.id, clientName: 'Ana López', date: '2026-10-05T15:00:00Z', createdAt: '2026-10-05T15:00:00Z', total: 1000, folio: 1 });
    await seedDoc({ key: 'withLines', companyId: companyA, clientId: ana.id, clientName: 'Ana López', date: '2026-10-08T15:00:00Z', createdAt: '2026-10-08T15:00:00Z', total: 500, paid: 200, finished: true, folio: 2, userId: author.id });
    await seedDoc({ key: 'paid', companyId: companyA, clientId: bruno.id, clientName: 'Bruno Díaz', date: '2026-09-20T15:00:00Z', createdAt: '2026-09-20T15:00:00Z', total: 300, paid: 300, finished: true, folio: 3 });
    await seedDoc({ key: 'today', companyId: companyA, clientId: bruno.id, clientName: 'Bruno Díaz', date: '2026-10-10T16:00:00Z', createdAt: '2026-10-09T12:00:00Z', total: 0, folio: 4 });
    // Same created_at as `today`: the cursor must break the tie by id.
    await seedDoc({ key: 'tie', companyId: companyA, clientId: null, clientName: 'Sin registro', date: '2026-10-09T12:00:00Z', createdAt: '2026-10-09T12:00:00Z', total: 50, paid: 0.005, folio: 5 });
    await seedDoc({ key: 'deleted', companyId: companyA, clientId: ana.id, clientName: 'Ana López', date: '2026-10-09T15:00:00Z', createdAt: '2026-10-09T15:00:00Z', total: 999, folio: 6, deleted: true });
    await seedDoc({ key: 'quoteOpen', companyId: companyA, kind: 'presupuesto', clientId: ana.id, clientName: 'Ana López', date: '2026-10-07T15:00:00Z', createdAt: '2026-10-07T15:00:00Z', total: 800, folio: 1 });
    await seedDoc({ key: 'quoteCanceled', companyId: companyA, kind: 'presupuesto', clientId: ana.id, clientName: 'Ana López', date: '2026-10-06T15:00:00Z', createdAt: '2026-10-06T15:00:00Z', total: 400, folio: 2, canceled: true });
    await seedDoc({ key: 'quoteConverted', companyId: companyA, kind: 'presupuesto', clientId: bruno.id, clientName: 'Bruno Díaz', date: '2026-10-01T15:00:00Z', createdAt: '2026-10-01T15:00:00Z', total: 700, folio: 3 });
    await seedDoc({ key: 'fromQuote', companyId: companyA, clientId: bruno.id, clientName: 'Bruno Díaz', date: '2026-10-02T15:00:00Z', createdAt: '2026-10-02T15:00:00Z', total: 700, paid: 700, finished: true, folio: 7, convertedFrom: 'quoteConverted' });
    await db
      .update(ticket)
      .set({ converted_to_ticket_id: ids.fromQuote })
      .where(inArray(ticket.id, [ids.quoteConverted]));

    // Company B: same client name and folio numbers as company A.
    await seedDoc({ key: 'otherCompany', companyId: companyB, clientId: anaB.id, clientName: 'Ana Otra Compañía', date: '2026-10-08T15:00:00Z', createdAt: '2026-10-08T15:00:00Z', total: 100, folio: 2 });

    const [inline] = await db
      .insert(servicesTickets)
      .values({ ticket_id: ids.withLines, name: 'Instalación de boiler', quantity: 2, price: 150 })
      .returning({ id: servicesTickets.id });
    const [gone] = await db
      .insert(servicesTickets)
      .values({ ticket_id: ids.withLines, name: 'Línea borrada', quantity: 1, price: 999, deleted_at: new Date() })
      .returning({ id: servicesTickets.id });
    await db.insert(ticketLineMaterial).values([
      { services_tickets_id: inline.id, name: 'Tubo de cobre', unit: 'm', quantity: 2, price: 50, sort_order: 0 },
      { services_tickets_id: inline.id, name: 'Material borrado', unit: 'pza', quantity: 1, price: 999, sort_order: 1, deleted_at: new Date() },
      { services_tickets_id: gone.id, name: 'Codo', unit: 'pza', quantity: 1, price: 10, sort_order: 0 },
    ]);
  });

  afterAll(async () => {
    const ticketIds = Object.values(ids);
    if (ticketIds.length > 0) {
      const lines = await db
        .select({ id: servicesTickets.id })
        .from(servicesTickets)
        .where(inArray(servicesTickets.ticket_id, ticketIds));
      if (lines.length > 0) {
        await db.delete(ticketLineMaterial).where(
          inArray(
            ticketLineMaterial.services_tickets_id,
            lines.map((line) => line.id),
          ),
        );
        await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ticketIds));
      }
      await db.delete(ticket).where(inArray(ticket.id, ticketIds));
    }
    if (companyIds.length > 0) {
      await db.delete(client).where(inArray(client.company_id, companyIds));
    }
    if (userIds.length > 0) {
      await db.delete(user).where(inArray(user.id, userIds));
    }
    if (companyIds.length > 0) {
      await db.delete(company).where(inArray(company.id, companyIds));
    }
    await (globalThis as { pool?: { end: () => Promise<void> } }).pool?.end();
  });

  const agentA = () => ({ companyId: companyA });
  const agentB = () => ({ companyId: companyB });

  const listIds = async (input: ListDocumentsInput) => {
    const result = await listAgentDocuments(agentA(), { limit: 100, ...input });
    expect(listDocumentsOutputSchema.safeParse(toJsonSafe(result)).error).toBeUndefined();
    return result.documents.map((doc) => doc.id);
  };

  const idsOf = (...keys: string[]) => keys.map((key) => ids[key].toString());

  describe('list_documents', () => {
    it('lists live documents of the company, newest first, both kinds by default', async () => {
      // `today` and `tie` share created_at; the higher id comes first.
      const tieOrder = ids.tie > ids.today ? ['tie', 'today'] : ['today', 'tie'];
      expect(await listIds({})).toEqual(
        idsOf(
          ...tieOrder,
          'withLines',
          'quoteOpen',
          'quoteCanceled',
          'overdue',
          'fromQuote',
          'quoteConverted',
          'paid',
        ),
      );
    });

    it('never returns soft-deleted rows or another company’s documents', async () => {
      const all = await listIds({});
      expect(all).not.toContain(ids.deleted.toString());
      expect(all).not.toContain(ids.otherCompany.toString());
      const fromB = await listAgentDocuments(agentB(), {});
      expect(fromB.documents.map((doc) => doc.id)).toEqual(idsOf('otherCompany'));
    });

    it('filters by kind', async () => {
      expect(await listIds({ kind: 'presupuesto' })).toEqual(
        idsOf('quoteOpen', 'quoteCanceled', 'quoteConverted'),
      );
      expect(await listIds({ kind: 'ticket' })).not.toContain(ids.quoteOpen.toString());
    });

    it('filters by client_id', async () => {
      expect(await listIds({ client_id: clientAna })).toEqual(
        idsOf('withLines', 'quoteOpen', 'quoteCanceled', 'overdue'),
      );
    });

    it('filters by folio with or without the prefix', async () => {
      expect(await listIds({ folio: 'R-0002' })).toEqual(idsOf('withLines'));
      expect(await listIds({ folio: 'p2' })).toEqual(idsOf('quoteCanceled'));
      expect((await listIds({ folio: '2' })).sort()).toEqual(
        idsOf('withLines', 'quoteCanceled').sort(),
      );
    });

    it('rejects a folio that is not shaped like one', async () => {
      await expect(listAgentDocuments(agentA(), { folio: 'abc def' })).rejects.toMatchObject({
        code: 'validation',
      });
    });

    it('filters by ticket_date range, both ends inclusive', async () => {
      expect(await listIds({ date_from: '2026-10-05', date_to: '2026-10-08' })).toEqual(
        idsOf('withLines', 'quoteOpen', 'quoteCanceled', 'overdue'),
      );
      expect(await listIds({ date_from: '2026-10-10' })).toEqual(idsOf('today'));
    });

    it('filters by payment_status with the same rule as getTicketPaymentStatus', async () => {
      const pagado = await listIds({ payment_status: 'pagado' });
      const parcial = await listIds({ payment_status: 'parcial' });
      const pendiente = await listIds({ payment_status: 'pendiente' });
      expect(pagado.sort()).toEqual(idsOf('paid', 'fromQuote').sort());
      expect(parcial).toEqual(idsOf('withLines'));
      // total 0 and a paid under the tolerance both count as pendiente.
      expect(pendiente).toEqual(expect.arrayContaining(idsOf('today', 'tie', 'overdue')));
      expect(pagado.length + parcial.length + pendiente.length).toBe((await listIds({})).length);

      const { documents } = await listAgentDocuments(agentA(), { limit: 100 });
      for (const doc of documents) {
        const expected = { paid: 'pagado', partial: 'parcial', pending: 'pendiente' }[
          getTicketPaymentStatus(doc.total, doc.paid)
        ];
        expect(doc.payment_status).toBe(expected);
      }
    });

    it('filters by finished', async () => {
      expect((await listIds({ finished: true, kind: 'ticket' })).sort()).toEqual(
        idsOf('withLines', 'paid', 'fromQuote').sort(),
      );
    });

    it('query matches the client name (case-insensitive) or the folio', async () => {
      expect(await listIds({ query: 'bruno' })).toEqual(
        idsOf('today', 'fromQuote', 'quoteConverted', 'paid'),
      );
      expect(await listIds({ query: 'R-3' })).toEqual(idsOf('paid'));
      expect(await listIds({ query: '100%' })).toEqual([]);
    });

    it('combines filters', async () => {
      expect(
        await listIds({ kind: 'ticket', client_id: clientAna, payment_status: 'pendiente' }),
      ).toEqual(idsOf('overdue'));
    });

    it('pages with the cursor until next_cursor is null, without repeats or gaps', async () => {
      const expected = await listIds({});
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await listAgentDocuments(agentA(), { limit: 2, cursor });
        expect(page.documents.length).toBeLessThanOrEqual(2);
        seen.push(...page.documents.map((doc) => doc.id));
        cursor = page.next_cursor ?? undefined;
        pages += 1;
      } while (cursor && pages < 20);
      expect(cursor).toBeUndefined();
      expect(seen).toEqual(expected);
      expect(pages).toBe(Math.ceil(expected.length / 2));
    });

    it('keeps filters across pages', async () => {
      const first = await listAgentDocuments(agentA(), { kind: 'presupuesto', limit: 2 });
      expect(first.next_cursor).not.toBeNull();
      const second = await listAgentDocuments(agentA(), {
        kind: 'presupuesto',
        limit: 2,
        cursor: first.next_cursor!,
      });
      expect([...first.documents, ...second.documents].map((doc) => doc.id)).toEqual(
        idsOf('quoteOpen', 'quoteCanceled', 'quoteConverted'),
      );
      expect(second.next_cursor).toBeNull();
    });

    it('rejects a cursor it did not issue', async () => {
      await expect(
        listAgentDocuments(agentA(), { cursor: 'not-a-cursor' }),
      ).rejects.toMatchObject({ code: 'validation' });
    });

    it('summaries carry kind, folio, payment_status, balance and presupuesto_status', async () => {
      const { documents } = await listAgentDocuments(agentA(), { limit: 100 });
      const byId = new Map(documents.map((doc) => [doc.id, doc]));
      expect(byId.get(ids.withLines.toString())).toMatchObject({
        kind: 'ticket',
        folio: { prefix: 'R', number: 2, label: 'R-0002' },
        payment_status: 'parcial',
        balance: 300,
        presupuesto_status: null,
      });
      expect(byId.get(ids.quoteOpen.toString())).toMatchObject({
        kind: 'presupuesto',
        folio: { label: 'P-0001' },
        presupuesto_status: 'abierto',
      });
      expect(byId.get(ids.quoteCanceled.toString())?.presupuesto_status).toBe('cancelado');
      expect(byId.get(ids.quoteConverted.toString())?.presupuesto_status).toBe('convertido');
    });
  });

  describe('get_document', () => {
    it('returns lines with live materials, subtotal, notes, folio, balance, client contact and urls', async () => {
      const doc = await getAgentDocument(agentA(), ids.withLines, { issuer: ISSUER });
      expect(getDocumentOutputSchema.safeParse(toJsonSafe({ document: doc })).error).toBeUndefined();
      expect(doc).toMatchObject({
        id: ids.withLines.toString(),
        kind: 'ticket',
        folio: { label: 'R-0002' },
        balance: 300,
        payment_status: 'parcial',
        work_notes: 'Revisar la fuga del baño',
        source_presupuesto_folio: null,
        client: {
          id: clientAna,
          name: 'Ana López',
          phone: '5512345678',
          email: 'ana@cliente.test',
          address: 'Av. Juárez #10, Centro, Puebla',
        },
        created_by: { name: 'Técnico Uno' },
        urls: {
          app: `${ISSUER}/tickets/${ids.withLines}`,
          pdf: `${ISSUER}/tickets/${ids.withLines}/recibo`,
          share: null,
        },
      });
      expect(doc.lines).toEqual([
        {
          id: expect.any(Number),
          service_id: null,
          name: 'Instalación de boiler',
          quantity: 2,
          price: 150,
          subtotal: 400,
          materials: [{ name: 'Tubo de cobre', quantity: 2, unit: 'm', price: 50 }],
        },
      ]);
    });

    it('a presupuesto links to /presupuestos and a converted ticket shows the source folio', async () => {
      const quote = await getAgentDocument(agentA(), ids.quoteConverted, { issuer: ISSUER });
      expect(quote.urls).toEqual({
        app: `${ISSUER}/presupuestos/${ids.quoteConverted}`,
        pdf: `${ISSUER}/presupuestos/${ids.quoteConverted}/pdf`,
        share: null,
      });
      expect(quote.converted_to_document_id).toBe(ids.fromQuote.toString());

      const converted = await getAgentDocument(agentA(), ids.fromQuote, { issuer: ISSUER });
      expect(converted.source_presupuesto_folio).toEqual({
        prefix: 'P',
        number: 3,
        label: 'P-0003',
      });
    });

    it('a document of another allow-listed company is not_found', async () => {
      await expect(
        getAgentDocument(agentA(), ids.otherCompany, { issuer: ISSUER }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        getAgentDocument(agentB(), ids.withLines, { issuer: ISSUER }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('a soft-deleted document is not_found', async () => {
      await expect(
        getAgentDocument(agentA(), ids.deleted, { issuer: ISSUER }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('get_company_summary', () => {
    it('matches the dashboard loaders for the seeded company on a fixed date', async () => {
      const summary = await getAgentCompanySummary(agentA(), { date: SUMMARY_DATE });
      expect(companySummaryOutputSchema.safeParse(toJsonSafe(summary)).error).toBeUndefined();

      const day = new Date(`${SUMMARY_DATE}T12:00:00.000Z`);
      const queue = await loadDashboardDayQueueForCompany(companyA, day, { limit: 10 });
      const metrics = await loadDashboardMetricsForCompany(companyA, 1);
      expect(metrics.success).toBe(true);
      const kpi = (key: string) => metrics.data!.kpis.find((item) => item.key === key)?.value;

      expect(summary.date).toBe(SUMMARY_DATE);
      expect(summary.queue.counts).toEqual({
        hoy: queue.counts.hoy,
        atrasados: queue.counts.atrasados,
        por_cobrar: queue.counts.porCobrar,
        recordatorios: queue.counts.recordatorios,
      });
      expect(summary.queue.hoy.map((doc) => doc.id)).toEqual(queue.hoy.map((row) => row.id));
      expect(summary.queue.atrasados.map((doc) => doc.id)).toEqual(
        queue.atrasados.map((row) => row.id),
      );
      expect(summary.por_cobrar_balance).toBe(queue.porCobrarBalance);
      expect(summary.pending_balance_total).toBe(kpi('outstandingBalance'));
      expect(summary.active_tickets).toBe(kpi('activeTickets'));

      // The same numbers, by hand, from the seed.
      expect(summary.queue.hoy.map((doc) => doc.id)).toEqual(idsOf('today'));
      expect(summary.queue.atrasados.map((doc) => doc.id).sort()).toEqual(
        idsOf('overdue', 'tie').sort(),
      );
      expect(summary.queue.counts.por_cobrar).toBe(1);
      expect(summary.por_cobrar_balance).toBe(300);
      // Finished work only (ZIG-I31-1): withLines 300; overdue and tie are En proceso.
      expect(summary.pending_balance_total).toBe(300);
      expect(summary.active_tickets).toBe(3);
      expect(summary.payment_status_counts).toEqual({
        pendiente: { count: 3, amount: 1050 },
        parcial: { count: 1, amount: 500 },
        pagado: { count: 2, amount: 1000 },
      });
      expect(summary.presupuestos_open).toBe(1);
    });

    it('another company only sees its own numbers', async () => {
      const summary = await getAgentCompanySummary(agentB(), { date: SUMMARY_DATE });
      expect(summary.presupuestos_open).toBe(0);
      expect(summary.queue.atrasados.map((doc) => doc.id)).toEqual(idsOf('otherCompany'));
      // Its only ticket is still En proceso, so nothing is cobrable yet (ZIG-I31-1).
      expect(summary.pending_balance_total).toBe(0);
    });
  });
});
