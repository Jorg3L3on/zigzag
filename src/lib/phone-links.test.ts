import { normalizePhoneForTel } from '@/lib/phone-links';

describe('phone link helpers', () => {
  it('keeps digits and a leading international plus', () => {
    expect(normalizePhoneForTel(' +52 (55) 1234-5678 ')).toBe('+525512345678');
  });

  it('returns null when no dialable digits exist', () => {
    expect(normalizePhoneForTel('ext. pending')).toBeNull();
    expect(normalizePhoneForTel('—')).toBeNull();
    expect(normalizePhoneForTel(null)).toBeNull();
  });
});
