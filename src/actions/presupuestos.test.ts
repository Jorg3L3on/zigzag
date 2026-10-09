import { convertPresupuestoToTicket } from '@/actions/presupuestos';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: { findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
      service: { findMany: jest.fn() },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/cache', () => ({
  invalidateCompanyCache: jest.fn(),
}));

jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

const mockDb = db as unknown as {
  query: { ticket: { findFirst: jest.Mock } };
  transaction: jest.Mock;
};

const authContext = { userId: '1', companyId: 10, companyIsSystem: false };

const quote = {
  id: 300n,
  company_id: 10,
  document_kind: 'presupuesto',
  client_id: 5,
  client_name: 'Plaza Comercial Aurora',
  client_tel: '5550001111',
  email: null,
  document: null,
  ticket_date: new Date('2026-10-09T12:00:00Z'),
  expires_at: null,
  canceled_at: null,
  converted_to_ticket_id: null,
  total: 5050,
  deleted_at: null,
  services_tickets: [
    { id: 1, service_id: 7, name: null, description: null, quantity: 1, price: 4200 },
    {
      id: 2,
      service_id: null,
      name: 'Cambio de capacitor',
      description: '35 µF',
      quantity: 1,
      price: 850,
    },
  ],
};

describe('convertPresupuestoToTicket (ZIG-I5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
  });

  it('copies catalog and inline lines verbatim onto the new ticket', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(quote);
    const lineInserts: unknown[] = [];
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn((table: unknown) => ({
          values: jest.fn((values: unknown) => {
            if (table === servicesTickets) {
              lineInserts.push(values);
              return Promise.resolve();
            }
            expect(table).toBe(ticket);
            return {
              returning: jest.fn(async () => [{ id: 301n, ...(values as object) }]),
            };
          }),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn(async () => [
                { ...quote, converted_to_ticket_id: 301n },
              ]),
            })),
          })),
        })),
      };
      return callback(tx);
    });

    const result = await convertPresupuestoToTicket(300, 10);

    expect(result.success).toBe(true);
    expect(result.data?.ticketId).toBe('301');
    expect(lineInserts).toEqual([
      [
        {
          ticket_id: 301n,
          service_id: 7,
          name: null,
          description: null,
          quantity: 1,
          price: 4200,
        },
        {
          ticket_id: 301n,
          service_id: null,
          name: 'Cambio de capacitor',
          description: '35 µF',
          quantity: 1,
          price: 850,
        },
      ],
    ]);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      300n,
      10,
      'presupuesto_converted',
      expect.objectContaining({ targetTicketId: '301' }),
    );
  });

  it('refuses a work ticket id', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      ...quote,
      document_kind: 'ticket',
    });

    const result = await convertPresupuestoToTicket(300, 10);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
