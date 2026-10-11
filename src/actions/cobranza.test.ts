const mockRequireTicketRead = jest.fn();
const mockFindMany = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: (...args: unknown[]) => mockRequireTicketRead(...args),
}));
jest.mock('@/lib/db', () => ({
  db: {
    query: { ticket: { findMany: (...args: unknown[]) => mockFindMany(...args) } },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

import { getCobranzaList } from '@/actions/cobranza';

const chain = (result: unknown[]) => {
  const node: Record<string, unknown> = {};
  for (const name of ['from', 'innerJoin', 'leftJoin', 'where']) {
    node[name] = () => node;
  }
  node.groupBy = () => Promise.resolve(result);
  return node;
};

const ticketRow = (id: number, overrides: Record<string, unknown> = {}) => ({
  id: BigInt(id),
  client_name: `Cliente ${id}`,
  client_tel: '5551234567',
  ticket_date: new Date('2026-01-01T12:00:00'),
  created_at: new Date('2026-01-01T12:00:00'),
  total: 100,
  paid: 0,
  finished: true,
  company_id: 7,
  document_kind: 'ticket',
  ...overrides,
});

describe('getCobranzaList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTicketRead.mockResolvedValue({ companyId: 7 });
  });

  it('scopes to the effective company and orders by days without payment', async () => {
    mockFindMany.mockResolvedValue([
      ticketRow(1, { ticket_date: new Date('2026-01-01T12:00:00') }),
      ticketRow(2, { ticket_date: new Date('2025-12-01T12:00:00'), paid: 40 }),
      ticketRow(3, { ticket_date: new Date('2026-01-05T12:00:00') }),
    ]);
    mockSelect
      // 2 paid recently, so fewer days without payment than ticket 1
      .mockReturnValueOnce(chain([{ ticket_id: BigInt(2), last_payment_at: new Date() }]))
      .mockReturnValueOnce(chain([{ ticket_id: BigInt(1), summary: 'Compresor, Mano de obra' }]));

    const result = await getCobranzaList(99);

    expect(mockRequireTicketRead).toHaveBeenCalledWith(99);
    expect(result.success).toBe(true);
    expect(result.data?.rows.map((r) => r.id)).toEqual(['1', '3', '2']);
    expect(result.data?.rows[0].services_summary).toBe('Compresor, Mano de obra');
  });
});
