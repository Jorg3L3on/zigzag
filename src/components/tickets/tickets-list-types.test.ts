import {
  filtersForTicketCollectionView,
  parseFinishedFilter,
  parseStatusFilter,
  ticketCollectionView,
} from '@/components/tickets/tickets-list-types';
import {
  DEFAULT_TICKET_SORTING,
  TICKETS_PHONE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/tickets/tickets-sort-presets';

describe('tickets list URL params (ZIG-I18-9)', () => {
  it('keeps every existing ?status= value working and falls back to all', () => {
    for (const value of ['paid', 'partial', 'pending', 'due'] as const) {
      expect(parseStatusFilter(value)).toBe(value);
    }
    expect(parseStatusFilter(null)).toBe('all');
    expect(parseStatusFilter('nope')).toBe('all');
  });

  it('keeps ?finished= working', () => {
    expect(parseFinishedFilter('yes')).toBe('yes');
    expect(parseFinishedFilter('no')).toBe('no');
    expect(parseFinishedFilter('x')).toBe('all');
  });
});

describe('collection views (ZIG-I28-4)', () => {
  it('maps each tab onto one existing URL filter and clears the other', () => {
    expect(filtersForTicketCollectionView('all')).toEqual({ status: 'all', finished: 'all' });
    // Por cobrar is finished work with a saldo (PR #610 review).
    expect(filtersForTicketCollectionView('due')).toEqual({ status: 'due', finished: 'yes' });
    expect(filtersForTicketCollectionView('paid')).toEqual({ status: 'paid', finished: 'all' });
    expect(filtersForTicketCollectionView('inProgress')).toEqual({
      status: 'all',
      finished: 'no',
    });
  });

  it('selects a tab only when the URL is exactly that view', () => {
    expect(ticketCollectionView('all', 'all')).toBe('all');
    expect(ticketCollectionView('due', 'yes')).toBe('due');
    expect(ticketCollectionView('due', 'all')).toBeNull();
    expect(ticketCollectionView('paid', 'all')).toBe('paid');
    expect(ticketCollectionView('all', 'no')).toBe('inProgress');
    expect(ticketCollectionView('due', 'no')).toBeNull();
    expect(ticketCollectionView('all', 'yes')).toBeNull();
    expect(ticketCollectionView('partial', 'all')).toBeNull();
  });
});

describe('phone sort options (ZIG-I18-9)', () => {
  it('are exactly recientes, antiguos and mayor saldo, and round-trip through the sort state', () => {
    expect(TICKETS_PHONE_SORT_OPTIONS.map((o) => o.label)).toEqual([
      'Más recientes',
      'Más antiguos',
      'Mayor saldo',
    ]);
    for (const option of TICKETS_PHONE_SORT_OPTIONS) {
      expect(encodeSortingState(decodeSortingState(option.value))).toBe(option.value);
    }
    expect(encodeSortingState(DEFAULT_TICKET_SORTING)).toBe(TICKETS_PHONE_SORT_OPTIONS[0].value);
  });
});
