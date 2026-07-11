import { OPERATOR_GUIDE_ANCHORS } from '@/lib/onboarding-guides';

export type OnboardingChecklistSignals = {
  profileReady: boolean;
  totalClients: number;
  totalServices: number;
  totalTickets: number;
  totalServicesSold: number;
  hasPaidOrFinishedTicket: boolean;
  finishedTicketCount: number;
  totalUsers: number;
  totalServiceSchedules: number;
  dismissedAt?: string | null;
};

export type OnboardingChecklistPermissions = {
  canManageCompany: boolean;
  canCreateClients: boolean;
  canCreateServices: boolean;
  canCreateTickets: boolean;
  canCreateUsers: boolean;
  canViewTickets: boolean;
  canViewSchedules: boolean;
};

export type OnboardingChecklistStep = {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
  actionLabel?: string;
  canAct: boolean;
  secondaryHref?: string;
  secondaryActionLabel?: string;
  secondaryCanAct?: boolean;
  guideHref?: string;
};

export type CompanyOnboardingChecklistSnapshot = {
  shouldShow: boolean;
  progress: { completed: number; total: number };
  steps: OnboardingChecklistStep[];
};

type ChecklistStepDefinition = {
  key: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryActionLabel?: string;
  guideHref: string;
  isComplete: (signals: OnboardingChecklistSignals) => boolean;
  canAct: (permissions: OnboardingChecklistPermissions) => boolean;
  secondaryCanAct?: (permissions: OnboardingChecklistPermissions) => boolean;
};

const CHECKLIST_STEP_DEFINITIONS: ChecklistStepDefinition[] = [
  {
    key: 'company_profile',
    title: '1. Configura Mi empresa',
    description: 'Logo, RFC y moneda antes de emitir facturas.',
    href: '/company',
    actionLabel: 'Mi empresa',
    guideHref: OPERATOR_GUIDE_ANCHORS.miEmpresa,
    isComplete: (signals) => signals.profileReady,
    canAct: (permissions) => permissions.canManageCompany,
  },
  {
    key: 'services',
    title: '2. Arma tu catálogo de servicios',
    description: 'Define precios y descripciones reutilizables en tickets.',
    href: '/services/new',
    actionLabel: 'Nuevo servicio',
    guideHref: OPERATOR_GUIDE_ANCHORS.servicios,
    isComplete: (signals) => signals.totalServices > 0,
    canAct: (permissions) => permissions.canCreateServices,
  },
  {
    key: 'clients',
    title: '3. Registra clientes',
    description: 'Guarda contactos frecuentes para crear tickets rápido.',
    href: '/clients/new',
    actionLabel: 'Nuevo cliente',
    guideHref: OPERATOR_GUIDE_ANCHORS.clientes,
    isComplete: (signals) => signals.totalClients > 0,
    canAct: (permissions) => permissions.canCreateClients,
  },
  {
    key: 'first_ticket',
    title: '4. Crea tu primer ticket',
    description: 'Agrega servicios del catálogo y registra el primer cobro.',
    href: '/tickets/create',
    actionLabel: 'Crear ticket',
    guideHref: OPERATOR_GUIDE_ANCHORS.crearTicket,
    isComplete: (signals) =>
      signals.totalTickets > 0 &&
      signals.totalServicesSold > 0 &&
      signals.hasPaidOrFinishedTicket,
    canAct: (permissions) => permissions.canCreateTickets,
  },
  {
    key: 'team',
    title: '5. Invita a tu equipo',
    description: 'Agrega al menos un operador o administrador adicional.',
    href: '/users',
    actionLabel: 'Invitar usuario',
    guideHref: OPERATOR_GUIDE_ANCHORS.roles,
    isComplete: (signals) => signals.totalUsers > 1,
    canAct: (permissions) => permissions.canCreateUsers,
  },
  {
    key: 'billing_followup',
    title: '6. Factura PDF y recordatorios',
    description: 'Finaliza un ticket y programa un servicio recurrente.',
    href: '/tickets',
    actionLabel: 'Ver tickets',
    secondaryHref: '/service-schedules',
    secondaryActionLabel: 'Recordatorios',
    guideHref: OPERATOR_GUIDE_ANCHORS.facturaPdf,
    isComplete: (signals) =>
      signals.finishedTicketCount > 0 && signals.totalServiceSchedules > 0,
    canAct: (permissions) => permissions.canViewTickets,
    secondaryCanAct: (permissions) => permissions.canViewSchedules,
  },
];

export const countCoreActivationSignals = (
  signals: OnboardingChecklistSignals,
): number =>
  [
    signals.totalServices > 0,
    signals.totalClients > 0,
    signals.totalTickets > 0,
  ].filter(Boolean).length;

export const areAllOnboardingStepsComplete = (
  signals: OnboardingChecklistSignals,
): boolean =>
  CHECKLIST_STEP_DEFINITIONS.every((definition) =>
    definition.isComplete(signals),
  );

export const shouldShowOnboardingChecklist = ({
  signals,
  needsCompanyContext = false,
}: {
  signals: OnboardingChecklistSignals;
  needsCompanyContext?: boolean;
}): boolean => {
  if (needsCompanyContext || signals.dismissedAt) {
    return false;
  }

  const allComplete = areAllOnboardingStepsComplete(signals);
  if (allComplete) {
    return false;
  }

  return (
    countCoreActivationSignals(signals) < 3 || !allComplete
  );
};

export const buildCompanyOnboardingChecklist = ({
  signals,
  permissions,
  needsCompanyContext = false,
}: {
  signals: OnboardingChecklistSignals;
  permissions: OnboardingChecklistPermissions;
  needsCompanyContext?: boolean;
}): CompanyOnboardingChecklistSnapshot => {
  const steps: OnboardingChecklistStep[] = CHECKLIST_STEP_DEFINITIONS.map(
    (definition) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      complete: definition.isComplete(signals),
      href: definition.href,
      actionLabel: definition.actionLabel,
      canAct: definition.canAct(permissions),
      secondaryHref: definition.secondaryHref,
      secondaryActionLabel: definition.secondaryActionLabel,
      secondaryCanAct: definition.secondaryCanAct?.(permissions) ?? false,
      guideHref: definition.guideHref,
    }),
  );

  const completed = steps.filter((step) => step.complete).length;

  return {
    shouldShow: shouldShowOnboardingChecklist({ signals, needsCompanyContext }),
    progress: { completed, total: steps.length },
    steps,
  };
};
