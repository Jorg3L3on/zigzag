import { TicketTotalCapError } from '@/lib/errors';
import { addMoney, lineTotalWithMaterials, MAX_TICKET_TOTAL } from '@/lib/money';
import {
  assertTicketTotalWithinCap,
  calculateTicketTotal,
} from '@/lib/ticket-financials';

jest.mock('@/lib/db', () => ({ db: {} }));

/** A mixed document: big, fractional-quantity and material-heavy lines (ZIG-I12). */
const mixedLines = [
  { quantity: 99, price: 99_999_990, materials: [{ quantity: 9_999.99, price: 12_345.67 }] },
  { quantity: 1.25, price: 333.33, materials: [{ quantity: 0.33, price: 0.35 }] },
  { quantity: 2.5, price: 0.01, materials: [] },
  { quantity: 7, price: 1_234.567, materials: null },
];

describe('composer and server totals agree (ZIG-I12)', () => {
  it('matches for a $9.9B mixed document', () => {
    const composerTotal = addMoney(...mixedLines.map(lineTotalWithMaterials));

    expect(calculateTicketTotal(mixedLines)).toBe(composerTotal);
    expect(composerTotal).toBeGreaterThan(9_900_000_000);
  });

  it('matches line by line for fractional quantities', () => {
    const lines = Array.from({ length: 40 }, (_, index) => ({
      quantity: 1.01 + index * 0.07,
      price: 10.05 + index * 0.13,
      materials: [{ quantity: 0.05 + index * 0.01, price: 3.33 }],
    }));

    expect(calculateTicketTotal(lines)).toBe(
      addMoney(...lines.map(lineTotalWithMaterials)),
    );
  });
});

describe('assertTicketTotalWithinCap', () => {
  it('accepts the cap and refuses one cent more', () => {
    expect(assertTicketTotalWithinCap(MAX_TICKET_TOTAL)).toBe(MAX_TICKET_TOTAL);
    expect(() => assertTicketTotalWithinCap(MAX_TICKET_TOTAL + 0.01)).toThrow(
      TicketTotalCapError,
    );
  });
});
