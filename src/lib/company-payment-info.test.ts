import {
  buildPaymentInfoLines,
  clabeCheckDigit,
  formatPaymentInfoLine,
  getCompanyPaymentInfo,
  isValidClabe,
  normalizeClabe,
} from '@/lib/company-payment-info';

describe('CLABE (ZIG-I20-1)', () => {
  it('computes the control digit with the 3-7-1 weights', () => {
    // Banxico's published example: 002 (Banamex) 010 (plaza) 07777777777 → 1.
    expect(clabeCheckDigit('00201007777777777')).toBe(1);
    expect(clabeCheckDigit('03218000011835971')).toBe(9);
  });

  it('accepts 18 digits whose last digit matches and rejects anything else', () => {
    expect(isValidClabe('002010077777777771')).toBe(true);
    expect(isValidClabe('0020 1007 7777 7777 71')).toBe(true);
    expect(isValidClabe('002-010-07777777777-1')).toBe(true);
    expect(isValidClabe('002010077777777772')).toBe(false);
    expect(isValidClabe('00201007777777777')).toBe(false);
    expect(isValidClabe('0020100777777777712')).toBe(false);
    expect(isValidClabe('00201007777777777a')).toBe(false);
    expect(isValidClabe('')).toBe(false);
    expect(isValidClabe(null)).toBe(false);
  });

  it('normalizes spaces and dashes away', () => {
    expect(normalizeClabe(' 0020 1007-7777 7777 71 ')).toBe('002010077777777771');
    expect(normalizeClabe(undefined)).toBe('');
  });
});

describe('company payment info', () => {
  it('is null until at least bank, holder or CLABE is set', () => {
    expect(getCompanyPaymentInfo(null)).toBeNull();
    expect(getCompanyPaymentInfo({})).toBeNull();
    expect(getCompanyPaymentInfo({ payment_note: 'Manda tu comprobante' })).toBeNull();
    expect(getCompanyPaymentInfo({ payment_bank: '  ' })).toBeNull();
    expect(getCompanyPaymentInfo({ payment_bank: 'BBVA' })).toEqual({
      bank: 'BBVA',
      holder: null,
      clabe: null,
      note: null,
    });
  });

  it('formats one line with only the parts that exist, and message lines with the note', () => {
    const info = getCompanyPaymentInfo({
      payment_bank: 'BBVA',
      payment_holder: 'Juan Pérez',
      payment_clabe: '002010077777777771',
      payment_note: 'Manda tu comprobante por WhatsApp',
    })!;
    expect(formatPaymentInfoLine(info)).toBe(
      'Banco BBVA · Titular Juan Pérez · CLABE 002010077777777771',
    );
    expect(formatPaymentInfoLine({ ...info, bank: null, note: null })).toBe(
      'Titular Juan Pérez · CLABE 002010077777777771',
    );
    expect(buildPaymentInfoLines(info)).toEqual([
      'Para pagar por transferencia:',
      'Banco BBVA · Titular Juan Pérez · CLABE 002010077777777771',
      'Manda tu comprobante por WhatsApp',
    ]);
    expect(buildPaymentInfoLines(null)).toEqual([]);
  });
});
