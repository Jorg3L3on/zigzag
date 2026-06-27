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
