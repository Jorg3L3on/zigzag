import { mergeOnboardingChecklistDismiss } from '@/lib/company-schema';

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
