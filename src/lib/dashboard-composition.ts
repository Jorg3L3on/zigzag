import type { DashboardKpiKey } from '@/lib/dashboard-kpi';
import type { DashboardPersona } from '@/lib/dashboard-persona';

/** Ordered, reusable dashboard slots. Presentation stays in shared widgets. */
export type DashboardWidgetId =
  | 'platformHome'
  | 'tuDia'
  | 'activity'
  | 'kpis'
  | 'charts';

export type DashboardComposition = {
  persona: DashboardPersona;
  widgets: DashboardWidgetId[];
  /** Revenue period select in the revenue chart header (KPIs are month over month). */
  showPeriodSelect: boolean;
  /** Acciones rápidas chip row right under the greeting. */
  showQuickActions: boolean;
  /** Which KPI keys to render (subset of metrics.kpis). */
  kpiKeys: DashboardKpiKey[] | 'all';
  /** Campo: Tu día opens on Hoy and carries the money chips in its header. */
  campoOperations?: boolean;
  sectionTitles: {
    kpis: string;
  };
  emptyCopy: {
    activityTitle: string;
    activityDescription: string;
  };
};

const ADMIN_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['tuDia', 'activity', 'kpis', 'charts'],
  showPeriodSelect: true,
  showQuickActions: true,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Desempeño',
  },
  emptyCopy: {
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'Cuando tu equipo opere en ZigZag, los eventos importantes aparecerán aquí.',
  },
};

const OPERATOR_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['tuDia', 'activity', 'kpis'],
  showPeriodSelect: false,
  showQuickActions: true,
  // Operations-first: open work and collections pressure (no assignee field exists).
  kpiKeys: ['activeTickets', 'outstandingBalance'],
  sectionTitles: {
    kpis: 'Tu operación',
  },
  emptyCopy: {
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'Tus movimientos en tickets y servicios aparecerán aquí conforme trabajes.',
  },
};

const VIEWER_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['kpis', 'charts', 'tuDia', 'activity'],
  showPeriodSelect: true,
  showQuickActions: false,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Resumen del negocio',
  },
  emptyCopy: {
    activityTitle: 'Sin actividad reciente',
    activityDescription:
      'La actividad de la empresa aparecerá aquí cuando el equipo trabaje en ZigZag.',
  },
};

const SYSTEM_COMPOSITION: Omit<DashboardComposition, 'persona'> = {
  widgets: ['platformHome'],
  showPeriodSelect: false,
  showQuickActions: false,
  kpiKeys: 'all',
  sectionTitles: {
    kpis: 'Plataforma',
  },
  emptyCopy: {
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

/** Hoy-first campo home: Tu día only, no charts / office chrome. */
export const buildCampoDashboardComposition = (
  persona: DashboardPersona,
): DashboardComposition => {
  if (persona === 'system') {
    return buildDashboardComposition(persona);
  }

  return {
    persona,
    widgets: ['tuDia'],
    showPeriodSelect: false,
    showQuickActions: false,
    kpiKeys: ['cashCollected', 'outstandingBalance'],
    campoOperations: true,
    sectionTitles: {
      kpis: 'Hoy',
    },
    emptyCopy: {
      activityTitle: 'Sin actividad reciente',
      activityDescription: 'Tus visitas aparecerán aquí conforme trabajes.',
    },
  };
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
        'create-presupuesto',
        'view-tickets',
        'view-schedules',
        'create-client',
        'create-service',
      ];
    case 'admin':
      return [
        'create-ticket',
        'create-presupuesto',
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
