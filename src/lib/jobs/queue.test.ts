import { backoffDelayMs } from '@/lib/jobs/queue';

describe('job queue backoff', () => {
  it('grows exponentially with attempts', () => {
    expect(backoffDelayMs(1)).toBe(30_000);
    expect(backoffDelayMs(2)).toBe(60_000);
    expect(backoffDelayMs(3)).toBe(120_000);
  });

  it('is capped at one hour', () => {
    expect(backoffDelayMs(20)).toBe(3_600_000);
  });

  it('clamps zero/low attempts to the base delay', () => {
    expect(backoffDelayMs(0)).toBe(30_000);
  });
});
