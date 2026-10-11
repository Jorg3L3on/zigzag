import {
  addMoney,
  multiplyMoney,
  roundMoney,
  subtractMoney,
  sumLineTotals,
} from '@/lib/money';

describe('money helpers', () => {
  it('rounds to cents without binary float drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(-1.005)).toBe(-1.01);
  });

  it('handles non-finite input as zero', () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('subtracts and multiplies safely', () => {
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
    expect(multiplyMoney(0.1, 3)).toBe(0.3);
    expect(multiplyMoney(19.99, 3)).toBe(59.97);
  });

  it('sums line totals rounded to cents', () => {
    const lines = [
      { quantity: 3, price: 0.1 },
      { quantity: 1, price: 0.2 },
    ];
    expect(sumLineTotals(lines)).toBe(0.5);
  });
});

describe('roundMoney at large magnitudes (ZIG-I12)', () => {
  it.each([
    [4_999_999.99, 4_999_999.99],
    [5_000_000, 5_000_000],
    [12_345_678.9, 12_345_678.9],
    [99_999_990, 99_999_990],
    [99_999_999.99, 99_999_999.99],
    [9_999_999_999.99, 9_999_999_999.99],
    [-12_345_678.9, -12_345_678.9],
  ])('keeps %d as %d', (input, expected) => {
    expect(roundMoney(input)).toBe(expected);
  });

  it('still rounds half-cent float noise up', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(5_000_000.005)).toBe(5_000_000.01);
  });

  it('multiplies 9,999 × 99,999,999.99 without phantom cents', () => {
    expect(multiplyMoney(99_999_999.99, 9_999)).toBe(999_899_999_900.01);
  });

  it('prices 99 × $99,999,990 exactly', () => {
    expect(multiplyMoney(99_999_990, 99)).toBe(9_899_999_010);
    expect(sumLineTotals([{ quantity: 99, price: 99_999_990 }])).toBe(9_899_999_010);
  });

  it('is idempotent', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let i = 0; i < 2_000; i += 1) {
      const value = next() * 10 ** Math.floor(next() * 11);
      const once = roundMoney(value);
      expect(roundMoney(once)).toBe(once);
    }
  });
});
