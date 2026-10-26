import { formatListDate } from '@/lib/format-list-date';
import { formatPhoneDisplay } from '@/lib/phone-links';

const now = new Date('2026-10-10T15:00:00');

describe('formatListDate (ZIG-I13-7)', () => {
  it('says hoy and ayer, then the short date', () => {
    expect(formatListDate(new Date('2026-10-10T08:00:00'), now)).toBe('hoy');
    expect(formatListDate(new Date('2026-10-09T23:00:00'), now)).toBe('ayer');
    expect(formatListDate(new Date('2026-10-01T12:00:00'), now)).toBe('jue 1 oct');
  });

  it('adds the year when it is not this one, and is empty without a date', () => {
    expect(formatListDate(new Date('2025-12-31T12:00:00'), now)).toBe('mié 31 dic 2025');
    expect(formatListDate(null, now)).toBe('');
    expect(formatListDate('not a date', now)).toBe('');
  });
});

describe('formatPhoneDisplay (ZIG-I13-7)', () => {
  it('groups ten digits and a +52 number', () => {
    expect(formatPhoneDisplay('9983457712')).toBe('998 345 7712');
    expect(formatPhoneDisplay('998-345-7712')).toBe('998 345 7712');
    expect(formatPhoneDisplay('+529983457712')).toBe('+52 998 345 7712');
  });

  it('reads a Mexican number saved with 52 or 521 and no + like the ten digits', () => {
    expect(formatPhoneDisplay('529981000000')).toBe('998 100 0000');
    expect(formatPhoneDisplay('52 998 100 0000')).toBe('998 100 0000');
    expect(formatPhoneDisplay('5219981000000')).toBe('998 100 0000');
  });

  it('returns anything else as typed, and null when empty', () => {
    expect(formatPhoneDisplay('5551234')).toBe('5551234');
    expect(formatPhoneDisplay('  ')).toBeNull();
    expect(formatPhoneDisplay(null)).toBeNull();
  });
});
