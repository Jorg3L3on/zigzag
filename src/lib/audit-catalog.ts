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
