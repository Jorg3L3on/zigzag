import {
  DEFAULT_TICKET_SORTING,
  encodeSortingState,
  parseTicketSortParam,
  ticketListSortForServer,
  ticketSortParam,
} from '@/components/tickets/tickets-sort-presets';

describe('tickets ?orden= and the server sort (ZIG-I33-2)', () => {
  it('reads what the headers write', () => {
    expect(parseTicketSortParam('total-desc')).toEqual([{ id: 'total', desc: true }]);
    expect(parseTicketSortParam('cliente-asc')).toEqual([{ id: 'client_name', desc: false }]);
    expect(parseTicketSortParam('saldo-desc')).toEqual([{ id: 'balance', desc: true }]);
    expect(parseTicketSortParam('folio-asc')).toEqual([{ id: 'id', desc: false }]);
  });

  it('still reads the values of the old sort select', () => {
    expect(parseTicketSortParam('ticket_date:asc')).toEqual([{ id: 'ticket_date', desc: false }]);
    expect(parseTicketSortParam('paymentRank:desc')).toEqual([{ id: 'paymentRank', desc: true }]);
    expect(parseTicketSortParam('client_tel:asc')).toEqual([{ id: 'client_tel', desc: false }]);
  });

  it('falls back to the newest ticket date for anything else', () => {
    for (const value of [null, '', 'total', 'total-up', 'services-asc', 'drop table-asc', '-desc']) {
      expect(parseTicketSortParam(value)).toBe(DEFAULT_TICKET_SORTING);
    }
  });

  it('maps the table columns onto the server columns', () => {
    expect(ticketListSortForServer([{ id: 'total', desc: true }])).toEqual({ column: 'total', direction: 'desc' });
    expect(ticketListSortForServer([{ id: 'balance', desc: false }])).toEqual({ column: 'saldo', direction: 'asc' });
    expect(ticketListSortForServer([{ id: 'paymentRank', desc: false }])).toEqual({ column: 'estado', direction: 'asc' });
    expect(ticketListSortForServer([])).toEqual({ column: 'fecha', direction: 'desc' });
    // A column the server does not sort by never reaches it.
    expect(ticketListSortForServer([{ id: 'services', desc: false }])).toEqual({ column: 'fecha', direction: 'desc' });
  });

  it('keeps the default out of the URL and round-trips the rest', () => {
    expect(ticketSortParam(DEFAULT_TICKET_SORTING)).toBeNull();
    const sorting = [{ id: 'total', desc: true }];
    expect(ticketSortParam(sorting)).toBe('total-desc');
    expect(parseTicketSortParam(ticketSortParam(sorting))).toEqual(sorting);
    // The phone select keeps reading its own values from the parsed state.
    expect(encodeSortingState(parseTicketSortParam('fecha-asc'))).toBe('ticket_date:asc');
  });
});
