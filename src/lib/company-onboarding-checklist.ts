import { OPERATOR_GUIDE_ANCHORS } from '@/lib/onboarding-guides';

export type OnboardingChecklistSignals = {
  profileReady: boolean;
  totalClients: number;
  totalServices: number;
};

export type OnboardingChecklistPermissions = {
  canManageCompany: boolean;
  canCreateClients: boolean;
  canCreateServices: boolean;
};

export type OnboardingChecklistStep = {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
  actionLabel?: string;
  canAct: boolean;
  guideHref?: string;
};

export type CompanyOnboardingChecklistSnapshot = {
  shouldShow: boolean;
  progress: { completed: number; total: number };
  steps: OnboardingChecklistStep[];
};

type SetupStepDefinition = {
  key: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  guideHref: string;
  isComplete: (signals: OnboardingChecklistSignals) => boolean;
  canAct: (permissions: OnboardingChecklistPermissions) => boolean;
};

const SETUP_CHECKLIST_STEPS: SetupStepDefinition[] = [
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
];

export const shouldShowOnboardingChecklist = ({
  signals,
  needsCompanyContext = false,
}: {
  signals: OnboardingChecklistSignals;
  needsCompanyContext?: boolean;
}): boolean => {
  if (needsCompanyContext) {
    return false;
  }

  return (
    !signals.profileReady ||
    signals.totalServices === 0 ||
    signals.totalClients === 0
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
  const steps: OnboardingChecklistStep[] = SETUP_CHECKLIST_STEPS.map(
    (definition) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      complete: definition.isComplete(signals),
      href: definition.href,
      actionLabel: definition.actionLabel,
      canAct: definition.canAct(permissions),
      guideHref: definition.guideHref,
    }),
  );

  const completed = steps.filter((step) => step.complete).length;
  const total = steps.length;

  return {
    shouldShow: shouldShowOnboardingChecklist({ signals, needsCompanyContext }),
    progress: { completed, total },
    steps,
  };
};
