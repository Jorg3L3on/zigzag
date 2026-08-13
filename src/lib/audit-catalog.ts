export const AUDIT_RESULTS = ['success', 'denied', 'failed'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const AUDIT_SOURCES = ['auth', 'action', 'api'] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const AUDIT_RESOURCE_TYPES = [
  'auth',
  'ticket',
  'client',
  'service',
  'company',
  'user',
  'role',
  'permission',
  'invoice',
  'export',
  'report',
  'security',
] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export const AUDIT_ACTIONS = [
  'signed_in',
  'signed_out',
  'sign_in_failed',
  'created',
  'updated',
  'deleted',
  'finished',
  'payment_collected',
  'presupuesto_converted',
  'presupuesto_canceled',
  'logo_uploaded',
  'logo_removed',
  'permissions_changed',
  'permission_assigned',
  'permission_removed',
  'export_generated',
  'offboarded',
  'generated',
  'permission_denied',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const isMember = <T extends string>(
  values: readonly T[],
  value: string,
): value is T => (values as readonly string[]).includes(value);

export const assertAuditResult = (value: string): AuditResult => {
  if (!isMember(AUDIT_RESULTS, value)) {
    throw new Error(`Invalid audit result: ${value}`);
  }
  return value;
};

export const assertAuditSource = (value: string): AuditSource => {
  if (!isMember(AUDIT_SOURCES, value)) {
    throw new Error(`Invalid audit source: ${value}`);
  }
  return value;
};

export const assertAuditResourceType = (value: string): AuditResourceType => {
  if (!isMember(AUDIT_RESOURCE_TYPES, value)) {
    throw new Error(`Invalid audit resource type: ${value}`);
  }
  return value;
};

export const assertAuditAction = (value: string): AuditAction => {
  if (!isMember(AUDIT_ACTIONS, value)) {
    throw new Error(`Invalid audit action: ${value}`);
  }
  return value;
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
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

export const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
  success: 'Éxito',
  denied: 'Denegado',
  failed: 'Fallido',
};

export const formatAuditActionLabel = (action: string): string =>
  isMember(AUDIT_ACTIONS, action) ? AUDIT_ACTION_LABELS[action] : action;

export const formatAuditResultLabel = (result: string): string =>
  isMember(AUDIT_RESULTS, result) ? AUDIT_RESULT_LABELS[result] : result;

export const AUDIT_RESOURCE_LABELS: Record<AuditResourceType, string> = {
  auth: 'Autenticación',
  ticket: 'Ticket',
  client: 'Cliente',
  service: 'Servicio',
  company: 'Empresa',
  user: 'Usuario',
  role: 'Rol',
  permission: 'Permiso',
  invoice: 'Recibo',
  export: 'Exportación',
  report: 'Informe',
  security: 'Seguridad',
};

export const AUDIT_SOURCE_LABELS: Record<AuditSource, string> = {
  auth: 'Auth',
  action: 'Acción',
  api: 'API',
};

export const formatAuditResourceTypeLabel = (resourceType: string): string =>
  isMember(AUDIT_RESOURCE_TYPES, resourceType)
    ? AUDIT_RESOURCE_LABELS[resourceType]
    : resourceType;

export const formatAuditSourceLabel = (source: string): string =>
  isMember(AUDIT_SOURCES, source) ? AUDIT_SOURCE_LABELS[source] : source;

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
      matchesLabelOrCode(action, AUDIT_ACTION_LABELS[action]),
    ),
    results: AUDIT_RESULTS.filter((result) =>
      matchesLabelOrCode(result, AUDIT_RESULT_LABELS[result]),
    ),
    resourceTypes: AUDIT_RESOURCE_TYPES.filter((type) =>
      matchesLabelOrCode(type, AUDIT_RESOURCE_LABELS[type]),
    ),
    sources: AUDIT_SOURCES.filter((source) =>
      matchesLabelOrCode(source, AUDIT_SOURCE_LABELS[source]),
    ),
  };
};
