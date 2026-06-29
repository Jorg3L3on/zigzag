import type { Ticket } from '@/actions/tickets';
import {
  buildTicketFilterChips,
  countActiveFilters,
  filterTickets,
  formatDateRangeLabel,
  hasActiveTicketFilters,
  ticketMatchesDateRange,
} from '@/components/tickets/tickets-list-filter-utils';

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: BigInt(1),
  client_id: 1,
  client_name: 'Cliente Alfa',
  client_tel: '5551234567',
  email: 'alfa@example.com',
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 100,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
  ...overrides,
});

describe('tickets-list-filter-utils', () => {
  it('filters tickets by search, status, pdf, finished, and date range', () => {
    const tickets = [
      makeTicket({ id: BigInt(1), client_name: 'Alfa', document: 'pdf-1' }),
      makeTicket({
        id: BigInt(2),
        client_name: 'Beta',
        document: null,
        paid: 100,
        finished: true,
        ticket_date: new Date('2026-06-01T12:00:00Z'),
      }),
    ];

    const filtered = filterTickets(tickets, {
      searchValue: 'alfa',
      statusFilter: 'all',
      pdfFilter: 'with',
      finishedFilter: 'no',
      dateRange: {
        from: new Date('2026-05-01T00:00:00Z'),
        to: new Date('2026-05-31T23:59:59Z'),
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.client_name).toBe('Alfa');
  });

  it('counts active filters and builds chips', () => {
    const filters = {
      searchValue: 'alfa',
      statusFilter: 'paid' as const,
      pdfFilter: 'all' as const,
      finishedFilter: 'yes' as const,
      dateRange: {
        from: new Date('2026-05-01T00:00:00Z'),
        to: new Date('2026-05-02T00:00:00Z'),
      },
    };

    expect(countActiveFilters(filters)).toBe(4);
    expect(hasActiveTicketFilters(filters)).toBe(true);

    const chips = buildTicketFilterChips([makeTicket()], 1, filters);
    expect(chips.some((chip) => chip.key === 'search')).toBe(true);
    expect(chips.some((chip) => chip.key === 'status')).toBe(true);
    expect(chips.some((chip) => chip.key === 'finished')).toBe(true);
    expect(chips.some((chip) => chip.key === 'date')).toBe(true);
  });

  it('formats date range labels and matches ticket dates', () => {
    const range = {
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-05-10T00:00:00Z'),
    };

    expect(formatDateRangeLabel(undefined)).toBe('Rango de fechas');
    expect(formatDateRangeLabel(range)).toContain('—');
    expect(
      ticketMatchesDateRange(new Date('2026-05-05T12:00:00Z'), range),
    ).toBe(true);
    expect(
      ticketMatchesDateRange(new Date('2026-06-01T12:00:00Z'), range),
    ).toBe(false);
  });
});
