import {
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
