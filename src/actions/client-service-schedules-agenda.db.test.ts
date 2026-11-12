/**
 * @jest-environment node
 *
 * The agenda actions (ZIG-I30) against a migrated Postgres, in two companies
 * created for the test: bucket counts from SQL match classifyScheduleBucket,
 * the bulk action never touches another company, and the history only lists
 * the same company and client's tickets with the schedule's service.
 *   SCHEDULES_DB_TEST=1 DATABASE_URL=... npx jest src/actions/client-service-schedules-agenda.db.test.ts
 */
import { addDays } from 'date-fns';
import { eq, inArray } from 'drizzle-orm';
import {
  client,
  clientServiceSchedule,
  company,
  service,
  servicesTickets,
  ticket,
} from '@/db/schema';

const mockCompany = { current: 0 };

jest.mock('@/lib/service-schedules-rbac-server', () => ({
  requireScheduleRead: jest.fn(async () => ({ companyId: mockCompany.current })),
  requireScheduleWrite: jest.fn(async () => ({ companyId: mockCompany.current })),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import {
  bulkClientServiceSchedules,
  getClientServiceScheduleHistory,
  listClientServiceSchedulesPaginated,
  markClientServiceScheduleDone,
} from '@/actions/client-service-schedules';
import { companyDay, companyDayStart } from '@/lib/company-day';
import { db } from '@/lib/db';
import { classifyScheduleBucket, DUE_SOON_DAYS } from '@/lib/schedule-buckets';

const enabled = process.env.SCHEDULES_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

describeDb('schedule agenda in fresh companies (real actions, real Postgres)', () => {
  const stamp = Date.now();
  const companyIds: number[] = [];
  let companyA = 0;
  let companyB = 0;
  let clientA = 0;
  let otherClientA = 0;
  let serviceA = 0;
  let otherServiceA = 0;
  let cleaningA = 0;
  let checkupA = 0;
  let foreignScheduleId = 0;
  const scheduleIds: Record<string, number> = {};

  const insertCompany = async (label: string) => {
    const [row] = await db
      .insert(company)
      .values({
        name: `Agenda ${label} ${stamp}`,
        phone: '5550000000',
        email: `agenda-${label}-${stamp}@test.local`,
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

  beforeAll(async () => {
    companyA = await insertCompany('a');
    companyB = await insertCompany('b');

    const clients = await db
      .insert(client)
      .values([
        { company_id: companyA, name: 'Ana Agenda', phone: '5551110000', city: 'Monterrey' },
        { company_id: companyA, name: 'Beto Agenda', phone: null },
        { company_id: companyB, name: 'Ana Ajena', phone: '5552220000' },
      ])
      .returning({ id: client.id });
    [clientA, otherClientA] = clients.map((row) => row.id);
    const foreignClient = clients[2].id;

    const services = await db
      .insert(service)
      .values([
        { company_id: companyA, name: 'Mantenimiento minisplit', description: 'x', price: 800 },
        { company_id: companyA, name: 'Carga de gas', description: 'x', price: 1200 },
        { company_id: companyA, name: 'Limpieza de ductos', description: 'x', price: 900 },
        { company_id: companyA, name: 'Revisión general', description: 'x', price: 500 },
        { company_id: companyB, name: 'Mantenimiento minisplit', description: 'x', price: 800 },
      ])
      .returning({ id: service.id });
    [serviceA, otherServiceA, cleaningA, checkupA] = services.map((row) => row.id);
    const foreignService = services[4].id;

    // One schedule per bucket edge, the cut in company days (America/Mexico_City).
    const today = companyDay(new Date()).date;
    const todayStart = companyDayStart(today);
    const soonEnd = companyDayStart(addDays(today, DUE_SOON_DAYS + 1));
    // The unique key is (company, client, service), so each row has its own pair.
    const rows: Array<{ key: string; next: Date; clientId: number; serviceId: number; paused?: boolean }> = [
      { key: 'overdueLong', next: addDays(today, -120), clientId: clientA, serviceId: serviceA },
      { key: 'overdueEdge', next: new Date(todayStart.getTime() - 1000), clientId: clientA, serviceId: cleaningA },
      { key: 'todayStart', next: todayStart, clientId: clientA, serviceId: checkupA },
      { key: 'soonLast', next: new Date(soonEnd.getTime() - 1000), clientId: otherClientA, serviceId: serviceA },
      { key: 'soonEnd', next: soonEnd, clientId: otherClientA, serviceId: cleaningA },
      { key: 'far', next: addDays(today, 90), clientId: otherClientA, serviceId: otherServiceA },
      { key: 'paused', next: addDays(today, -30), clientId: clientA, serviceId: otherServiceA, paused: true },
    ];
    for (const row of rows) {
      const [inserted] = await db
        .insert(clientServiceSchedule)
        .values({
          company_id: companyA,
          client_id: row.clientId,
          service_id: row.serviceId,
          interval_value: 6,
          interval_unit: 'month',
          last_service_at: addDays(row.next, -180),
          next_due_at: row.next,
          paused_at: row.paused ? new Date() : null,
        })
        .returning({ id: clientServiceSchedule.id });
      scheduleIds[row.key] = inserted.id;
    }
    const [foreign] = await db
      .insert(clientServiceSchedule)
      .values({
        company_id: companyB,
        client_id: foreignClient,
        service_id: foreignService,
        interval_value: 6,
        interval_unit: 'month',
        next_due_at: addDays(today, -10),
      })
      .returning({ id: clientServiceSchedule.id });
    foreignScheduleId = foreign.id;

    // Tickets: two of the client with the service, one without it, one of
    // another client, one deleted, one presupuesto, and one in company B.
    const insertTicket = async (values: {
      companyId: number;
      clientId: number;
      serviceId: number;
      date: Date;
      kind?: string;
      deleted?: boolean;
      folio: number;
    }) => {
      const [row] = await db
        .insert(ticket)
        .values({
          company_id: values.companyId,
          client_id: values.clientId,
          client_name: 'x',
          ticket_date: values.date,
          total: 1000,
          paid: 400,
          finished: true,
          document_kind: values.kind ?? 'ticket',
          folio_prefix: values.kind === 'presupuesto' ? 'P' : 'R',
          folio_number: values.folio,
          deleted_at: values.deleted ? new Date() : null,
          updated_at: values.date,
        })
        .returning({ id: ticket.id });
      await db.insert(servicesTickets).values({
        ticket_id: row.id,
        service_id: values.serviceId,
        quantity: 1,
        price: 1000,
      });
      return row.id;
    };
    await insertTicket({ companyId: companyA, clientId: clientA, serviceId: serviceA, date: addDays(today, -200), folio: 1 });
    await insertTicket({ companyId: companyA, clientId: clientA, serviceId: serviceA, date: addDays(today, -20), folio: 2 });
    await insertTicket({ companyId: companyA, clientId: clientA, serviceId: otherServiceA, date: addDays(today, -5), folio: 3 });
    await insertTicket({ companyId: companyA, clientId: otherClientA, serviceId: serviceA, date: addDays(today, -3), folio: 4 });
    await insertTicket({ companyId: companyA, clientId: clientA, serviceId: serviceA, date: addDays(today, -2), folio: 5, deleted: true });
    await insertTicket({ companyId: companyA, clientId: clientA, serviceId: serviceA, date: addDays(today, -1), folio: 1, kind: 'presupuesto' });
    await insertTicket({ companyId: companyB, clientId: foreignClient, serviceId: foreignService, date: addDays(today, -1), folio: 1 });
  });

  afterAll(async () => {
    if (companyIds.length) {
      const ticketIds = (
        await db.select({ id: ticket.id }).from(ticket).where(inArray(ticket.company_id, companyIds))
      ).map((row) => row.id);
      if (ticketIds.length) {
        await db.delete(servicesTickets).where(inArray(servicesTickets.ticket_id, ticketIds));
        await db.delete(ticket).where(inArray(ticket.id, ticketIds));
      }
      await db.delete(clientServiceSchedule).where(inArray(clientServiceSchedule.company_id, companyIds));
      await db.delete(service).where(inArray(service.company_id, companyIds));
      await db.delete(client).where(inArray(client.company_id, companyIds));
      await db.delete(company).where(inArray(company.id, companyIds));
    }
  });

  beforeEach(() => {
    mockCompany.current = companyA;
  });

  it('counts every view in SQL exactly as classifyScheduleBucket does', async () => {
    const result = await listClientServiceSchedulesPaginated({ view: 'todos', pageSize: 100 });
    expect(result.success).toBe(true);
    const items = result.data!.items;
    expect(items.map((item) => item.id).sort()).toEqual(Object.values(scheduleIds).sort());

    const now = new Date();
    const expected = { atrasados: 0, proximos: 0, programados: 0, pausados: 0 };
    for (const item of items) {
      const bucket = classifyScheduleBucket(
        new Date(item.nextDueAt),
        item.pausedAt ? new Date(item.pausedAt) : null,
        now,
      );
      expect(item.bucket).toBe(bucket);
      expected[bucket] += 1;
    }
    expect(result.data!.counts).toEqual({
      ...expected,
      'por-atender': expected.atrasados + expected.proximos,
      todos: items.length,
    });
    expect(expected).toEqual({ atrasados: 2, proximos: 2, programados: 2, pausados: 1 });

    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get(scheduleIds.overdueEdge)?.bucket).toBe('atrasados');
    expect(byId.get(scheduleIds.overdueEdge)?.daysUntilDue).toBe(-1);
    expect(byId.get(scheduleIds.todayStart)?.bucket).toBe('proximos');
    expect(byId.get(scheduleIds.todayStart)?.daysUntilDue).toBe(0);
    expect(byId.get(scheduleIds.soonLast)?.daysUntilDue).toBe(DUE_SOON_DAYS);
    expect(byId.get(scheduleIds.soonEnd)?.bucket).toBe('programados');
  });

  it('pages Por atender most overdue first and filters by search and service', async () => {
    const first = await listClientServiceSchedulesPaginated({ pageSize: 3 });
    expect(first.data!.view).toBe('por-atender');
    expect(first.data!.total).toBe(4);
    expect(first.data!.totalPages).toBe(2);
    expect(first.data!.items.map((item) => item.id)).toEqual([
      scheduleIds.overdueLong,
      scheduleIds.overdueEdge,
      scheduleIds.todayStart,
    ]);

    const search = await listClientServiceSchedulesPaginated({ view: 'todos', search: 'beto' });
    expect(search.data!.counts.todos).toBe(3);
    expect(search.data!.counts['por-atender']).toBe(1);
    expect(search.data!.counts.proximos).toBe(1);

    const byService = await listClientServiceSchedulesPaginated({
      view: 'todos',
      serviceId: otherServiceA,
    });
    expect(byService.data!.items.map((item) => item.id).sort()).toEqual(
      [scheduleIds.far, scheduleIds.paused].sort(),
    );
  });

  it('never lists, counts or changes another company’s schedule', async () => {
    const all = await listClientServiceSchedulesPaginated({ view: 'todos', pageSize: 100 });
    expect(all.data!.items.some((item) => item.id === foreignScheduleId)).toBe(false);

    const bulk = await bulkClientServiceSchedules({
      ids: [scheduleIds.overdueLong, foreignScheduleId],
      action: 'delete',
    });
    expect(bulk).toMatchObject({ success: false, errorCode: 'SS001' });
    const [stillThere] = await db
      .select({ deleted: clientServiceSchedule.deleted_at })
      .from(clientServiceSchedule)
      .where(eq(clientServiceSchedule.id, scheduleIds.overdueLong));
    expect(stillThere.deleted).toBeNull();

    const history = await getClientServiceScheduleHistory(foreignScheduleId);
    expect(history).toMatchObject({ success: false, errorCode: 'SS001' });
  });

  it('lists only the same company and client’s tickets with the service in the history', async () => {
    const result = await getClientServiceScheduleHistory(scheduleIds.overdueLong);
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.schedule.clientCity).toBe('Monterrey');
    expect(data.serviceTickets.map((row) => row.folio)).toEqual(['R-0002', 'R-0001']);
    expect(data.serviceTicketCount).toBe(2);
    expect(data.serviceTickets[0]).toMatchObject({ total: 1000, paid: 400, finished: true });
    expect(data.otherTickets.map((row) => row.folio)).toEqual(['R-0003']);
    expect(data.otherTicketCount).toBe(1);
  });

  it('marks a schedule done from SQL and moves it to Programados', async () => {
    const today = companyDay(new Date()).iso;
    const result = await markClientServiceScheduleDone(scheduleIds.overdueLong, today);
    expect(result.success).toBe(true);

    const after = await listClientServiceSchedulesPaginated({ view: 'programados', pageSize: 100 });
    const row = after.data!.items.find((item) => item.id === scheduleIds.overdueLong);
    expect(row?.bucket).toBe('programados');
    expect(row?.daysSinceLast).toBe(0);
  });
});
