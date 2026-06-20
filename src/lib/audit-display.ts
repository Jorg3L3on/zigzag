import type { AuditResourceType } from '@/lib/audit-catalog';

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

  const label = `${resourceType}#${resourceId}`;
  const type = resourceType as AuditResourceType;

  switch (type) {
    case 'ticket':
      return { href: `/tickets/${resourceId}`, label };
    case 'client':
      return { href: `/clients/${resourceId}/edit`, label };
    case 'service':
      return { href: `/services/${resourceId}/edit`, label };
    case 'company':
      return { href: `/companies/${resourceId}/edit`, label };
    default:
      return null;
  }
};

export const formatAuditResourceLabel = (
  resourceType: string,
  resourceId: string | null | undefined,
): string => `${resourceType}${resourceId ? `#${resourceId}` : ''}`;
