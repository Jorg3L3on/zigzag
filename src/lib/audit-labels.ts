import type {
  AuditAction,
  AuditResourceType,
  AuditResult,
  AuditSource,
} from '@/lib/audit-catalog';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
  AUDIT_SOURCES,
} from '@/lib/audit-catalog';

const ACTION_LABELS: Record<AuditAction, string> = {
  signed_in: 'Inicio de sesión',
  signed_out: 'Cierre de sesión',
  sign_in_failed: 'Inicio de sesión fallido',
  created: 'Creación',
  updated: 'Actualización',
  deleted: 'Eliminación',
  finished: 'Finalización',
  payment_collected: 'Cobro registrado',
  presupuesto_converted: 'Presupuesto convertido',
  presupuesto_canceled: 'Presupuesto cancelado',
  logo_uploaded: 'Logo subido',
  logo_removed: 'Logo eliminado',
  permissions_changed: 'Permisos modificados',
  permission_assigned: 'Permiso asignado',
  permission_removed: 'Permiso eliminado',
  export_generated: 'Exportación generada',
  offboarded: 'Baja de empresa',
  generated: 'Generación',
  permission_denied: 'Permiso denegado',
};

const RESULT_LABELS: Record<AuditResult, string> = {
  success: 'Éxito',
  denied: 'Denegado',
  failed: 'Fallido',
};

const RESOURCE_TYPE_LABELS: Record<AuditResourceType, string> = {
  auth: 'Sesión',
  ticket: 'Ticket',
  client: 'Cliente',
  service: 'Servicio',
  company: 'Empresa',
  user: 'Usuario',
  role: 'Rol',
  permission: 'Permiso',
  invoice: 'Recibo',
  export: 'Exportación',
  report: 'Reporte',
  security: 'Seguridad',
};

const SOURCE_LABELS: Record<AuditSource, string> = {
  auth: 'Auth',
  action: 'Acción',
  api: 'API',
};

export const formatAuditActionLabel = (action: string): string =>
  ACTION_LABELS[action as AuditAction] ?? action;

export const formatAuditResultLabel = (result: string): string =>
  RESULT_LABELS[result as AuditResult] ?? result;

export const formatAuditResourceTypeLabel = (resourceType: string): string =>
  RESOURCE_TYPE_LABELS[resourceType as AuditResourceType] ?? resourceType;

export const formatAuditSourceLabel = (source: string): string =>
  SOURCE_LABELS[source as AuditSource] ?? source;

const normalizeSearchTerm = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export type AuditSearchCatalogMatches = {
  actions: AuditAction[];
  results: AuditResult[];
  resourceTypes: AuditResourceType[];
  sources: AuditSource[];
};

/** Map free-text (incl. Spanish labels) to catalog enum codes for search. */
export const resolveAuditSearchCatalogMatches = (
  search: string,
): AuditSearchCatalogMatches => {
  const normalized = normalizeSearchTerm(search);
  if (!normalized) {
    return { actions: [], results: [], resourceTypes: [], sources: [] };
  }

  const matchesLabelOrCode = (code: string, label: string): boolean => {
    const codeNorm = normalizeSearchTerm(code);
    const labelNorm = normalizeSearchTerm(label);
    return (
      codeNorm.includes(normalized) ||
      labelNorm.includes(normalized) ||
      normalized.includes(codeNorm) ||
      normalized.includes(labelNorm)
    );
  };

  return {
    actions: AUDIT_ACTIONS.filter((action) =>
      matchesLabelOrCode(action, ACTION_LABELS[action]),
    ),
    results: AUDIT_RESULTS.filter((result) =>
      matchesLabelOrCode(result, RESULT_LABELS[result]),
    ),
    resourceTypes: AUDIT_RESOURCE_TYPES.filter((type) =>
      matchesLabelOrCode(type, RESOURCE_TYPE_LABELS[type]),
    ),
    sources: AUDIT_SOURCES.filter((source) =>
      matchesLabelOrCode(source, SOURCE_LABELS[source]),
    ),
  };
};
