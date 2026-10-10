import {
  companySettingsSchema,
  mergeOnboardingChecklistDismiss,
  normalizeCompanySettingsForDb,
} from '@/lib/company-schema';

describe('mergeOnboardingChecklistDismiss', () => {
  it('preserves existing settings while recording dismiss timestamp', () => {
    expect(
      mergeOnboardingChecklistDismiss(
        { rfc: 'ACM010101AAA', default_currency: 'MXN' },
        '2026-07-11T12:00:00.000Z',
      ),
    ).toEqual({
      rfc: 'ACM010101AAA',
      default_currency: 'MXN',
      onboarding_checklist_dismissed_at: '2026-07-11T12:00:00.000Z',
    });
  });
});

describe('settings.tagline (Lema o giro)', () => {
  it('accepts up to 60 characters and trims', () => {
    expect(companySettingsSchema.parse({ tagline: '  Climatización · Servicio técnico  ' }).tagline).toBe(
      'Climatización · Servicio técnico',
    );
    expect(companySettingsSchema.safeParse({ tagline: 'a'.repeat(60) }).success).toBe(true);
    expect(companySettingsSchema.safeParse({ tagline: '' }).success).toBe(true);
  });

  it('rejects 61 characters', () => {
    const result = companySettingsSchema.safeParse({ tagline: 'a'.repeat(61) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Máximo 60 caracteres');
  });

  it('stores the tagline and keeps an empty one so clearing overrides the saved value', () => {
    expect(normalizeCompanySettingsForDb({ tagline: 'Plomería' })).toEqual({ tagline: 'Plomería' });
    expect(normalizeCompanySettingsForDb({ tagline: '' })).toEqual({ tagline: '' });
    expect(normalizeCompanySettingsForDb({ rfc: 'X' })).toEqual({ rfc: 'X' });
  });
});
