export const GUIDE_VERSION = '2026.07';

export const ONBOARDING_GUIDE_PATHS = {
  resumenEjecutivo: '/guides/resumen-ejecutivo.html',
  empresa: '/guides/guia-empresa.html',
  empresaMaestra: '/guides/guia-empresa-maestra.html',
  index: '/guides/index.html',
} as const;

export type OnboardingGuideLink = {
  href: string;
  label: string;
  description: string;
  audience?: 'investor' | 'operator' | 'platform';
  audienceLabel?: string;
};

export const EXECUTIVE_SUMMARY_LINK: OnboardingGuideLink = {
  href: ONBOARDING_GUIDE_PATHS.resumenEjecutivo,
  label: 'Resumen ejecutivo',
  description: 'Visión del producto para inversores y socios estratégicos.',
  audience: 'investor',
  audienceLabel: 'Evalúo invertir o asociarme',
};

export const EMPRESA_GUIDE_LINK: OnboardingGuideLink = {
  href: ONBOARDING_GUIDE_PATHS.empresa,
  label: 'Guía para empresas',
  description: 'Tickets, clientes, servicios, PDF y recordatorios.',
  audience: 'operator',
  audienceLabel: 'Opero una empresa',
};

export const EMPRESA_MAESTRA_GUIDE_LINK: OnboardingGuideLink = {
  href: ONBOARDING_GUIDE_PATHS.empresaMaestra,
  label: 'Guía empresa maestra',
  description: 'Consola operadora, auditoría y administración multi-tenant.',
  audience: 'platform',
  audienceLabel: 'Administro la plataforma',
};

/** Shown on the public login page (all audiences). */
export const PUBLIC_ONBOARDING_GUIDE_LINKS: OnboardingGuideLink[] = [
  EXECUTIVE_SUMMARY_LINK,
  EMPRESA_GUIDE_LINK,
  EMPRESA_MAESTRA_GUIDE_LINK,
];

/** In-app guides menu for authenticated users. */
export const getOnboardingGuidesForUser = (
  isSystemUser: boolean,
): OnboardingGuideLink[] =>
  isSystemUser
    ? [EXECUTIVE_SUMMARY_LINK, EMPRESA_MAESTRA_GUIDE_LINK, EMPRESA_GUIDE_LINK]
    : [EMPRESA_GUIDE_LINK];

export const getGuidesMenuHref = (isSystemUser: boolean): string =>
  isSystemUser ? ONBOARDING_GUIDE_PATHS.index : ONBOARDING_GUIDE_PATHS.empresa;

export const openOnboardingGuide = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer');
};

/** Deep links into the operator guide for in-app empty states. */
export const OPERATOR_GUIDE_ANCHORS = {
  clientes: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-5`,
  servicios: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-4`,
  crearTicket: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-7`,
  agregarServicios: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-8`,
  facturaPdf: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-10`,
  recordatorios: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-11`,
  roles: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-12`,
  mobile: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-13`,
  busqueda: `${ONBOARDING_GUIDE_PATHS.empresa}#paso-14`,
} as const;
