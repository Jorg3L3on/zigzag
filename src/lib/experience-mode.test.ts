import { describe, expect, it } from '@jest/globals';
import { resolveExperienceMode } from '@/lib/experience-mode';

describe('resolveExperienceMode', () => {
  it('returns office for system companies even when unset', () => {
    expect(
      resolveExperienceMode(null, { totalUsers: 1, isSystemCompany: true }),
    ).toBe('office');
  });

  it('defaults to campo for single-user non-system tenants', () => {
    expect(
      resolveExperienceMode(undefined, {
        totalUsers: 1,
        isSystemCompany: false,
      }),
    ).toBe('campo');
    expect(
      resolveExperienceMode({}, { totalUsers: 0, isSystemCompany: false }),
    ).toBe('campo');
  });

  it('defaults to office when more than one user', () => {
    expect(
      resolveExperienceMode(null, { totalUsers: 2, isSystemCompany: false }),
    ).toBe('office');
  });

  it('honors explicit experience_mode', () => {
    expect(
      resolveExperienceMode(
        { experience_mode: 'office' },
        { totalUsers: 1, isSystemCompany: false },
      ),
    ).toBe('office');
    expect(
      resolveExperienceMode(
        { experience_mode: 'campo' },
        { totalUsers: 5, isSystemCompany: false },
      ),
    ).toBe('campo');
  });
});
