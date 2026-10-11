import {
  parseFinishedFilter,
  parseStatusFilter,
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
