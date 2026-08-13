import type { AuditResourceType } from '@/lib/audit-catalog';
import { formatAuditResourceTypeLabel } from '@/lib/audit-labels';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'remembertoken',
  'remember_token',
  'remember-token',
  'key',
];

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  const compact = normalized.replace(/[\s_-]/g, '');
  return SENSITIVE_KEY_PATTERNS.some(
    (pattern) => normalized.includes(pattern) || compact.includes(pattern),
  );
};

export const redactAuditDisplayValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactAuditDisplayValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redactAuditDisplayValue(entry),
      ]),
    );
  }

  return value;
};

const isPlainPositiveInteger = (value: string): boolean => /^[1-9]\d*$/.test(value);

export type AuditResourceLink = {
  href: string;
  label: string;
};

export const resolveAuditResourceLink = (
  resourceType: string,
  resourceId: string | null | undefined,
): AuditResourceLink | null => {
  if (!resourceId || !isPlainPositiveInteger(resourceId)) {
    return null;
  }

  const type = resourceType as AuditResourceType;

  switch (type) {
    case 'ticket':
      return { href: `/tickets/${resourceId}`, label: `Ticket #${resourceId}` };
    case 'invoice':
      // Invoice audits store the ticket id as resource_id.
      return {
        href: `/tickets/${resourceId}`,
        label: `Recibo · Ticket #${resourceId}`,
      };
    case 'client':
      return {
        href: `/clients/${resourceId}/edit`,
        label: `Cliente #${resourceId}`,
      };
    case 'service':
      return {
        href: `/services/${resourceId}/edit`,
        label: `Servicio #${resourceId}`,
      };
    case 'company':
      return {
        href: `/companies/${resourceId}/edit`,
        label: `Empresa #${resourceId}`,
      };
    case 'user':
      return { href: `/users`, label: `Usuario #${resourceId}` };
    default:
      return null;
  }
};

export type FormatAuditResourceLabelOptions = {
  actorName?: string | null;
};

export const formatAuditResourceLabel = (
  resourceType: string,
  resourceId: string | null | undefined,
  options: FormatAuditResourceLabelOptions = {},
): string => {
  const typeLabel = formatAuditResourceTypeLabel(resourceType);

  if (resourceType === 'auth') {
    const actorName = options.actorName?.trim();
    if (actorName) {
      return `Sesión · ${actorName}`;
    }
    if (resourceId?.includes('@')) {
      return `Sesión · ${resourceId}`;
    }
    return 'Sesión';
  }

  if (resourceType === 'security') {
    return resourceId ? `Seguridad · ${resourceId}` : 'Seguridad';
  }

  if (!resourceId) {
    return typeLabel;
  }

  if (isPlainPositiveInteger(resourceId)) {
    return `${typeLabel} #${resourceId}`;
  }

  return `${typeLabel} · ${resourceId}`;
};
