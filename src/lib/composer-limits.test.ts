import {
  parseDecimalText,
  shouldShowCounter,
  validateLineAmount,
  validatePriceText,
  validateQuantityText,
} from '@/lib/composer-limits';

describe('parseDecimalText', () => {
  it('reads dots and commas and refuses text', () => {
    expect(parseDecimalText('1.5')).toBe(1.5);
    expect(parseDecimalText(' 1,5 ')).toBe(1.5);
    expect(parseDecimalText('')).toBeNull();
    expect(parseDecimalText('abc')).toBeNull();
  });
});

describe('validateQuantityText', () => {
  it.each([
    ['1', null],
    ['1.5', null],
    ['0.01', null],
    ['9999.99', null],
    ['0', 'Mínimo 0.01'],
    ['-3', 'Mínimo 0.01'],
    ['99999', 'Máximo 9,999.99'],
    ['10000', 'Máximo 9,999.99'],
    ['1.234', 'Usa máximo 2 decimales'],
    ['', 'Escribe una cantidad'],
  ])('%s -> %s', (text, expected) => {
    expect(validateQuantityText(text)).toBe(expected);
  });
});

describe('validatePriceText', () => {
  it.each([
    ['', null],
    ['0', null],
    ['350.5', null],
    ['99999999.99', null],
    ['-50', 'El precio no puede ser negativo'],
    ['999999999', 'Máximo $99,999,999.99'],
    ['100000000', 'Máximo $99,999,999.99'],
    ['10.999', 'Usa máximo 2 decimales'],
  ])('%s -> %s', (text, expected) => {
    expect(validatePriceText(text)).toBe(expected);
  });
});

describe('validateLineAmount', () => {
  it('accepts a line under the cap', () => {
    expect(validateLineAmount(1000, 5000)).toBeNull();
  });

  it('refuses a line over the cap on its own', () => {
    expect(validateLineAmount(999_899_999_900.01, 0)).toContain('$9,999,999,999.99');
  });

  it('refuses a line that pushes the document over the cap', () => {
    expect(validateLineAmount(5_000_000_000, 5_000_000_000)).toContain('$9,999,999,999.99');
    expect(validateLineAmount(5_000_000_000, 4_999_999_999.99)).toBeNull();
  });
});

describe('shouldShowCounter', () => {
  it('shows from 80% of the limit', () => {
    expect(shouldShowCounter(79, 100)).toBe(false);
    expect(shouldShowCounter(80, 100)).toBe(true);
    expect(shouldShowCounter(1599, 2000)).toBe(false);
    expect(shouldShowCounter(1600, 2000)).toBe(true);
  });
});
