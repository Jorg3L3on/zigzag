import { AYUDA_PATH } from '@/lib/marketing-routes';

/** How the in-app help reads for a tradesperson (ZIG-I18-12). */
export const HELP_GUIDE_LABEL = '¿Cómo se usa?';

export type OnboardingGuideLink = {
  href: string;
  label: string;
  description: string;
};

/**
 * The one help link (ZIG-I40-6): the /ayuda help centre replaced the static
 * /guides pages, and the executive summary was retired with them.
 */
export const HELP_CENTER_LINK: OnboardingGuideLink = {
  href: AYUDA_PATH,
  label: 'Centro de ayuda',
  description: 'Guías cortas: tickets, cobro, presupuestos, clientes y equipo.',
};

export const openOnboardingGuide = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer');
};

const ayudaGuide = (slug: string) => `${AYUDA_PATH}/${slug}`;

/** Links from the onboarding checklist into the matching /ayuda guide. */
export const OPERATOR_GUIDE_ANCHORS = {
  miEmpresa: AYUDA_PATH,
  clientes: ayudaGuide('guardar-un-cliente'),
  servicios: ayudaGuide('armar-mi-lista-de-precios'),
  crearTicket: ayudaGuide('crear-un-ticket'),
  agregarServicios: ayudaGuide('crear-un-ticket'),
  facturaPdf: ayudaGuide('mandar-el-recibo-por-whatsapp'),
  recordatorios: ayudaGuide('programar-un-mantenimiento'),
  roles: ayudaGuide('invitar-a-mi-equipo'),
  mobile: ayudaGuide('instalar-zigzag-en-mi-telefono'),
} as const;
