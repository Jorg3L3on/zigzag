/**
 * Campo vs office experience mode for first-customer field program.
 */

import type { CompanySettingsJson } from '@/db/schema';

export type ExperienceMode = 'campo' | 'office';

export type ExperienceModeSignals = {
  /** Active (non-deleted) users in the company. */
  totalUsers: number;
  /** System company never gets campo auto-default. */
  isSystemCompany: boolean;
};

export const EXPERIENCE_MODE_VALUES = ['campo', 'office'] as const;

export const isExperienceMode = (value: unknown): value is ExperienceMode =>
  value === 'campo' || value === 'office';

/**
 * Resolve campo | office from settings + tenant signals.
 * Explicit settings win; otherwise single-user non-system tenants default to campo.
 */
export const resolveExperienceMode = (
  settings: CompanySettingsJson | null | undefined,
  signals: ExperienceModeSignals,
): ExperienceMode => {
  if (signals.isSystemCompany) {
    return 'office';
  }

  const explicit = settings?.experience_mode;
  if (isExperienceMode(explicit)) {
    return explicit;
  }

  if (signals.totalUsers <= 1) {
    return 'campo';
  }

  return 'office';
};

export const experienceModeLabel = (mode: ExperienceMode): string =>
  mode === 'campo' ? 'Campo (técnico solo)' : 'Oficina (equipo)';
