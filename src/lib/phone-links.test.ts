import { buildTelHref, normalizePhoneForTel } from '@/lib/phone-links';

describe('phone link helpers', () => {
  it('keeps digits and a leading international plus for tel links', () => {
    expect(normalizePhoneForTel(' +52 (55) 1234-5678 ')).toBe('+525512345678');
    expect(buildTelHref(' +52 (55) 1234-5678 ')).toBe('tel:+525512345678');
  });

  it('returns null when no dialable digits exist', () => {
    expect(normalizePhoneForTel('ext. pending')).toBeNull();
    expect(buildTelHref('—')).toBeNull();
    expect(buildTelHref(null)).toBeNull();
  });
});
