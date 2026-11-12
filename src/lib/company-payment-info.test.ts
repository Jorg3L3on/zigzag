import {
  buildPaymentInfoLines,
  clabeCheckDigit,
  formatPaymentInfoLine,
  getCompanyPaymentInfo,
  paymentPdfHeading,
  isValidAccountNumber,
  isValidCardNumber,
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

  it('stays the ungrouped CLABE line when payment_kind is absent (ZIG-23)', () => {
    const info = getCompanyPaymentInfo({
      payment_bank: 'BBVA',
      payment_holder: 'Juan Pérez',
      payment_clabe: '002010077777777771',
    })!;
    expect(info.kind).toBeUndefined();
    expect(formatPaymentInfoLine(info)).toBe(
      'Banco BBVA · Titular Juan Pérez · CLABE 002010077777777771',
    );
    expect(buildPaymentInfoLines(info)[0]).toBe('Para pagar por transferencia:');
    expect(paymentPdfHeading(info)).toBe('PARA PAGAR POR TRANSFERENCIA');
  });

  it('groups an explicit CLABE 3-3-11-1, a card by 4 and an account by 4', () => {
    const clabe = getCompanyPaymentInfo({
      payment_kind: 'clabe',
      payment_clabe: '002010077777777771',
    })!;
    expect(formatPaymentInfoLine(clabe)).toBe('CLABE 002 010 07777777777 1');
    expect(buildPaymentInfoLines(clabe)[0]).toBe('Para pagar por transferencia:');

    const card = getCompanyPaymentInfo({
      payment_kind: 'card',
      payment_bank: 'BBVA',
      payment_card: '4111111111111111',
    })!;
    expect(card).toMatchObject({ kind: 'card', clabe: '4111111111111111' });
    expect(formatPaymentInfoLine(card)).toBe('Banco BBVA · Tarjeta 4111 1111 1111 1111');
    expect(buildPaymentInfoLines(card)[0]).toBe('Para pagar con tarjeta:');
    expect(paymentPdfHeading(card)).toBe('PARA PAGAR CON TARJETA');

    const account = getCompanyPaymentInfo({
      payment_kind: 'account',
      payment_account: '12345678901',
    })!;
    expect(formatPaymentInfoLine(account)).toBe('Cuenta 1234 5678 901');
    expect(buildPaymentInfoLines(account)[0]).toBe('Para pagar a la cuenta:');
    expect(paymentPdfHeading(account)).toBe('PARA PAGAR A LA CUENTA');
  });
});

describe('card and account numbers (ZIG-23)', () => {
  it('accepts 15–19 digits that pass Luhn and rejects the rest', () => {
    expect(isValidCardNumber('4111111111111111')).toBe(true);
    expect(isValidCardNumber('378282246310005')).toBe(true);
    expect(isValidCardNumber('4111 1111 1111 1111')).toBe(true);
    expect(isValidCardNumber('4111111111111112')).toBe(false);
    expect(isValidCardNumber('411111111111111')).toBe(false);
    expect(isValidCardNumber('41111111111111111111')).toBe(false);
  });

  it('accepts an account of 10 or 11 digits', () => {
    expect(isValidAccountNumber('1234567890')).toBe(true);
    expect(isValidAccountNumber('1234 5678 901')).toBe(true);
    expect(isValidAccountNumber('123456789')).toBe(false);
    expect(isValidAccountNumber('123456789012')).toBe(false);
  });
});
