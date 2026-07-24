import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import type { DashboardPersona } from '@/lib/dashboard-persona';

/** Ordered, reusable dashboard slots. Presentation stays in shared widgets. */
export type DashboardWidgetId =
  | 'onboarding'
  | 'platformHome'
  | 'needsAttention'
  | 'kpis'
  | 'charts'
  | 'operations'
  | 'quickActions';

export type DashboardComposition = {
  persona: DashboardPersona;
  widgets: DashboardWidgetId[];
  showExports: boolean;
  showQuickActions: boolean;
  /** Which KPI keys to render (subset of metrics.kpis). */
  kpiKeys: DashboardKpiKey[] | 'all';
  sectionTitles: {
    kpis: string;
    operations: string;
  };
  emptyCopy: {
    attentionTitle: string;
    attentionDescription: string;
    activityTitle: string;
    activityDescription: string;
  };
};

const ADMIN_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: [
    'onboarding',
    'needsAttention',
    'kpis',
    'charts',
    'operations',
    'quickActions',
  ],
  showExports: true,
  showQuickActions: true,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Desempeño',
    operations: 'Actividad',
  },
  emptyCopy: {
    attentionTitle: 'Todo marcha bien hoy',
    attentionDescription:
      'No hay cobros, tickets activos ni recordatorios urgentes que requieran tu atención.',
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'Cuando tu equipo opere en ZigZag, los eventos importantes aparecerán aquí.',
  },
};

const OPERATOR_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: [
    'onboarding',
    'needsAttention',
    'operations',
    'kpis',
    'quickActions',
  ],
  showExports: false,
  showQuickActions: true,
  // Operations-first: open work and collections pressure (no assignee field exists).
  kpiKeys: ['activeTickets', 'outstandingBalance'],
  sectionTitles: {
    kpis: 'Tu operación',
    operations: 'Trabajo de hoy',
  },
  emptyCopy: {
    attentionTitle: 'Sin trabajo urgente hoy',
    attentionDescription:
      'No hay tickets ni recordatorios que requieran tu seguimiento ahora.',
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'Tus movimientos en tickets y servicios aparecerán aquí conforme trabajes.',
  },
};

const VIEWER_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['onboarding', 'kpis', 'charts', 'operations'],
  showExports: true,
  showQuickActions: false,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Resumen del negocio',
    operations: 'Actividad',
  },
  emptyCopy: {
    attentionTitle: 'Nada pendiente',
    attentionDescription: 'El resumen está al día por ahora.',
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'La actividad de la empresa aparecerá aquí cuando el equipo trabaje en ZigZag.',
  },
};

const SYSTEM_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['platformHome'],
  showExports: false,
  showQuickActions: false,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Plataforma',
    operations: 'Actividad de plataforma',
  },
  emptyCopy: {
    attentionTitle: 'Selecciona una empresa',
    attentionDescription:
      'Elige una empresa en el menú superior para ver su operación, o abre la consola operadora.',
    activityTitle: 'Sin contexto de empresa',
    activityDescription:
      'La actividad de plataforma vive en la consola operadora y la auditoría del sistema.',
  },
};

export const buildDashboardComposition = (
  persona: DashboardPersona,
): DashboardComposition => {
  switch (persona) {
    case 'system':
      return { persona, ...SYSTEM_COMPOSITION };
    case 'operator':
      return { persona, ...OPERATOR_COMPOSITION };
    case 'viewer':
      return { persona, ...VIEWER_COMPOSITION };
    case 'admin':
    default:
      return { persona, ...ADMIN_COMPOSITION };
  }
};

export type DashboardIntroContext = {
  companyName?: string | null;
  attentionCount: number;
  persona: DashboardPersona;
};

/** Subtle personalized subtitle under the greeting. */
export const buildDashboardIntroSubtitle = (
  ctx: DashboardIntroContext,
): string => {
  if (ctx.persona === 'system') {
    return 'Vista de plataforma — selecciona una empresa para operar';
  }

  if (ctx.attentionCount > 0) {
    const noun =
      ctx.attentionCount === 1 ? 'pendiente' : 'pendientes';
    return `Tienes ${ctx.attentionCount} ${noun} que revisar`;
  }

  if (ctx.persona === 'operator') {
    return 'Todo al día por ahora — buen momento para avanzar trabajo nuevo';
  }

  if (ctx.persona === 'viewer') {
    return ctx.companyName?.trim()
      ? `Resumen de ${ctx.companyName.trim()}`
      : 'Resumen de la empresa';
  }

  return ctx.companyName?.trim()
    ? `Bienvenido — ${ctx.companyName.trim()} está al día`
    : 'Bienvenido — todo está al día hoy';
};

/** Quick-action keys preferred first for each persona (permission still gates). */
export const quickActionPriority = (
  persona: DashboardPersona,
): string[] => {
  switch (persona) {
    case 'operator':
      return [
        'create-ticket',
        'view-tickets',
        'view-schedules',
        'create-client',
        'create-service',
      ];
    case 'admin':
      return [
        'create-ticket',
        'create-client',
        'create-service',
        'create-user',
        'view-tickets',
        'view-schedules',
      ];
    case 'viewer':
      return ['view-tickets', 'view-schedules'];
    default:
      return [
        'operator-console',
        'view-companies',
        'view-audit',
      ];
  }
};
