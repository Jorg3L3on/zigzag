import type { CompanyLifecycleStatus } from '@/db/schema';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';

export type LifecycleHistoryRow = {
  id: number;
  at: string;
  /** «Activada», «Suspendida», «Empresa creada»… */
  title: string;
  /** «En configuración a Activa». */
  change: string;
  who: string;
  operator: boolean;
  reason: string | null;
};

export type LifecycleHistorySource = {
  id: number;
  at: Date;
  action: string;
  before_status: string | null;
  after_status: string | null;
  reason: string | null;
  actor_name: string | null;
  actor_company_id: number | null;
  target_company_id: number | null;
};

const VERB: Record<string, string> = {
  ACTIVE: 'Activada',
  SUSPENDED: 'Suspendida',
  ARCHIVED: 'Archivada',
  SETUP: 'En configuración',
};

const label = (status: string | null): string =>
  status ? companyLifecycleLabel(status as CompanyLifecycleStatus) : '—';

/**
 * Status history of Ciclo de vida (ZIG-I38-7, audit L3): one row per company
 * audit event whose status changed (or the creation), newest first.
 */
export const buildLifecycleHistory = (
  sources: LifecycleHistorySource[],
): LifecycleHistoryRow[] =>
  sources
    .filter(
      (row) =>
        row.action === 'created' ||
        (row.after_status != null && row.after_status !== row.before_status),
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((row) => {
      const created = row.action === 'created';
      const restored = row.before_status === 'SUSPENDED' && row.after_status === 'ACTIVE';
      return {
        id: row.id,
        at: row.at.toISOString(),
        title: created
          ? 'Empresa creada'
          : restored
            ? 'Acceso restaurado'
            : VERB[row.after_status ?? ''] ?? 'Cambio de estado',
        change: created
          ? label(row.after_status ?? 'SETUP')
          : `${label(row.before_status)} a ${label(row.after_status)}`,
        who: row.actor_name ?? 'Sistema',
        operator:
          row.actor_company_id != null &&
          row.target_company_id != null &&
          row.actor_company_id !== row.target_company_id,
        reason: row.reason,
      };
    });
