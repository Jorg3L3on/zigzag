import {
  buildCompanyOnboardingChecklist,
  shouldShowOnboardingChecklist,
  type OnboardingChecklistPermissions,
  type OnboardingChecklistSignals,
} from '@/lib/company-onboarding-checklist';

const fullPermissions: OnboardingChecklistPermissions = {
  canManageCompany: true,
  canCreateClients: true,
  canCreateServices: true,
};

const activatedSignals: OnboardingChecklistSignals = {
  profileReady: true,
  totalClients: 2,
  totalServices: 3,
};

describe('company-onboarding-checklist', () => {
  it('shows the checklist when profile, services, or clients are missing', () => {
    expect(
      shouldShowOnboardingChecklist({
        signals: { profileReady: false, totalClients: 0, totalServices: 0 },
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingChecklist({
        signals: { profileReady: true, totalClients: 1, totalServices: 0 },
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingChecklist({
        signals: activatedSignals,
      }),
    ).toBe(false);
  });

  it('hides the checklist for system users without tenant context', () => {
    expect(
      shouldShowOnboardingChecklist({
        signals: { profileReady: false, totalClients: 0, totalServices: 0 },
        needsCompanyContext: true,
      }),
    ).toBe(false);
  });

  it('builds guide-aligned setup steps with completion and progress', () => {
    const snapshot = buildCompanyOnboardingChecklist({
      signals: { profileReady: true, totalClients: 0, totalServices: 1 },
      permissions: fullPermissions,
    });

    expect(snapshot.shouldShow).toBe(true);
    expect(snapshot.progress).toEqual({ completed: 2, total: 3 });
    expect(snapshot.steps.map((step) => step.key)).toEqual([
      'company_profile',
      'services',
      'clients',
    ]);
    expect(snapshot.steps[0]?.complete).toBe(true);
    expect(snapshot.steps[1]?.complete).toBe(true);
    expect(snapshot.steps[2]?.complete).toBe(false);
    expect(snapshot.steps[0]?.guideHref).toContain('#paso-3');
  });

  it('omits action buttons when the user lacks create permissions', () => {
    const snapshot = buildCompanyOnboardingChecklist({
      signals: { profileReady: false, totalClients: 0, totalServices: 0 },
      permissions: {
        canManageCompany: false,
        canCreateClients: true,
        canCreateServices: false,
      },
    });

    expect(snapshot.steps[0]?.canAct).toBe(false);
    expect(snapshot.steps[1]?.canAct).toBe(false);
    expect(snapshot.steps[2]?.canAct).toBe(true);
    expect(snapshot.steps.every((step) => step.guideHref)).toBe(true);
  });
});
