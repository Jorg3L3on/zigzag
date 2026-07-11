import {
  areAllOnboardingStepsComplete,
  buildCompanyOnboardingChecklist,
  countCoreActivationSignals,
  shouldShowOnboardingChecklist,
  type OnboardingChecklistPermissions,
  type OnboardingChecklistSignals,
} from '@/lib/company-onboarding-checklist';

const fullPermissions: OnboardingChecklistPermissions = {
  canManageCompany: true,
  canCreateClients: true,
  canCreateServices: true,
  canCreateTickets: true,
  canCreateUsers: true,
  canViewTickets: true,
  canViewSchedules: true,
};

const activatedSignals: OnboardingChecklistSignals = {
  profileReady: true,
  totalClients: 2,
  totalServices: 3,
  totalTickets: 1,
  totalServicesSold: 2,
  hasPaidOrFinishedTicket: true,
  finishedTicketCount: 1,
  totalUsers: 2,
  totalServiceSchedules: 1,
};

const emptySignals: OnboardingChecklistSignals = {
  profileReady: false,
  totalClients: 0,
  totalServices: 0,
  totalTickets: 0,
  totalServicesSold: 0,
  hasPaidOrFinishedTicket: false,
  finishedTicketCount: 0,
  totalUsers: 1,
  totalServiceSchedules: 0,
};

describe('company-onboarding-checklist', () => {
  it('shows the checklist when setup or activation steps remain incomplete', () => {
    expect(
      shouldShowOnboardingChecklist({
        signals: emptySignals,
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingChecklist({
        signals: {
          ...activatedSignals,
          totalServiceSchedules: 0,
        },
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingChecklist({
        signals: activatedSignals,
      }),
    ).toBe(false);
  });

  it('keeps the checklist visible when fewer than three core resources exist', () => {
    expect(
      countCoreActivationSignals({
        ...activatedSignals,
        totalTickets: 0,
        totalServiceSchedules: 0,
        finishedTicketCount: 0,
        hasPaidOrFinishedTicket: false,
      }),
    ).toBe(2);
    expect(
      shouldShowOnboardingChecklist({
        signals: {
          ...activatedSignals,
          totalTickets: 0,
          totalServicesSold: 0,
          hasPaidOrFinishedTicket: false,
          finishedTicketCount: 0,
          totalServiceSchedules: 0,
        },
      }),
    ).toBe(true);
  });

  it('hides the checklist for system users without tenant context or dismiss', () => {
    expect(
      shouldShowOnboardingChecklist({
        signals: emptySignals,
        needsCompanyContext: true,
      }),
    ).toBe(false);
    expect(
      shouldShowOnboardingChecklist({
        signals: {
          ...emptySignals,
          dismissedAt: '2026-07-11T00:00:00.000Z',
        },
      }),
    ).toBe(false);
  });

  it('builds six guide-aligned steps with completion and progress', () => {
    const snapshot = buildCompanyOnboardingChecklist({
      signals: {
        ...activatedSignals,
        totalTickets: 1,
        totalServicesSold: 0,
        hasPaidOrFinishedTicket: false,
        totalServiceSchedules: 0,
      },
      permissions: fullPermissions,
    });

    expect(snapshot.progress).toEqual({ completed: 4, total: 6 });
    expect(snapshot.steps.map((step) => step.key)).toEqual([
      'company_profile',
      'services',
      'clients',
      'first_ticket',
      'team',
      'billing_followup',
    ]);
    expect(snapshot.steps[3]?.complete).toBe(false);
    expect(snapshot.steps[4]?.href).toBe('/users');
    expect(snapshot.steps[5]?.secondaryHref).toBe('/service-schedules');
    expect(snapshot.steps[0]?.guideHref).toContain('#paso-3');
  });

  it('marks the first ticket step incomplete without services sold or payment', () => {
    const snapshot = buildCompanyOnboardingChecklist({
      signals: {
        ...activatedSignals,
        totalTickets: 1,
        totalServicesSold: 0,
        hasPaidOrFinishedTicket: false,
      },
      permissions: fullPermissions,
    });

    expect(snapshot.steps[3]?.complete).toBe(false);
    expect(
      areAllOnboardingStepsComplete({
        ...activatedSignals,
        totalTickets: 1,
        totalServicesSold: 0,
        hasPaidOrFinishedTicket: false,
      }),
    ).toBe(false);
  });

  it('omits action buttons when the user lacks create permissions', () => {
    const snapshot = buildCompanyOnboardingChecklist({
      signals: emptySignals,
      permissions: {
        canManageCompany: false,
        canCreateClients: true,
        canCreateServices: false,
        canCreateTickets: false,
        canCreateUsers: false,
        canViewTickets: true,
        canViewSchedules: false,
      },
    });

    expect(snapshot.steps[0]?.canAct).toBe(false);
    expect(snapshot.steps[3]?.canAct).toBe(false);
    expect(snapshot.steps[4]?.canAct).toBe(false);
    expect(snapshot.steps.every((step) => step.guideHref)).toBe(true);
  });
});
