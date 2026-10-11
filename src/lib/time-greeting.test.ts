import {
  getGreetingFromTimeZoneCookie,
  getHourInTimeZone,
  getTimeOfDayGreeting,
  NEUTRAL_TIME_GREETING,
} from '@/lib/time-greeting';

describe('getTimeOfDayGreeting', () => {
  it('returns Buenos días before noon', () => {
    expect(getTimeOfDayGreeting(0)).toBe('Buenos días');
    expect(getTimeOfDayGreeting(11)).toBe('Buenos días');
  });

  it('returns Buenas tardes from noon until 7pm', () => {
    expect(getTimeOfDayGreeting(12)).toBe('Buenas tardes');
    expect(getTimeOfDayGreeting(13)).toBe('Buenas tardes');
    expect(getTimeOfDayGreeting(18)).toBe('Buenas tardes');
  });

  it('returns Buenas noches from 7pm onward', () => {
    expect(getTimeOfDayGreeting(19)).toBe('Buenas noches');
    expect(getTimeOfDayGreeting(23)).toBe('Buenas noches');
  });

  it('exports a neutral fallback for SSR', () => {
    expect(NEUTRAL_TIME_GREETING).toBe('Hola');
  });
});

describe('getHourInTimeZone', () => {
  // 19:30 UTC is 13:30 in Mexico City (UTC-6, no DST).
  const now = new Date('2026-10-11T19:30:00Z');

  it('returns the local hour for an IANA time zone', () => {
    expect(getHourInTimeZone('America/Mexico_City', now)).toBe(13);
    expect(getHourInTimeZone('UTC', now)).toBe(19);
  });

  it('returns null for a missing or unknown time zone', () => {
    expect(getHourInTimeZone(undefined, now)).toBeNull();
    expect(getHourInTimeZone('Not/AZone', now)).toBeNull();
  });
});

describe('getGreetingFromTimeZoneCookie', () => {
  const now = new Date('2026-10-11T19:30:00Z');

  it('greets in the cookie time zone instead of the server clock', () => {
    expect(
      getGreetingFromTimeZoneCookie(
        encodeURIComponent('America/Mexico_City'),
        now,
      ),
    ).toBe('Buenas tardes');
  });

  it('returns null without a usable cookie so the client decides', () => {
    expect(getGreetingFromTimeZoneCookie(undefined, now)).toBeNull();
    expect(getGreetingFromTimeZoneCookie('%E0%A4%A', now)).toBeNull();
    expect(getGreetingFromTimeZoneCookie('Not%2FAZone', now)).toBeNull();
  });
});
