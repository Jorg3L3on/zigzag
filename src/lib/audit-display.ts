import type { AuditResourceType } from '@/lib/audit-catalog';
import { formatAuditResourceTypeLabel } from '@/lib/audit-labels';
import { resolveAuditResourceDisplayName } from '@/lib/audit-event-summary';
import { operatorTenantHref } from '@/lib/operator-tenant-scope';

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

export type ResolveAuditResourceLinkOptions = {
  /** When set (operator console), preserve tenant context on deep links. */
  tenantCompanyId?: number;
};

export const resolveAuditResourceLink = (
  resourceType: string,
  resourceId: string | null | undefined,
  options?: ResolveAuditResourceLinkOptions,
): AuditResourceLink | null => {
  if (!resourceId || !isPlainPositiveInteger(resourceId)) {
    return null;
  }

  const type = resourceType as AuditResourceType;
  const withTenant = (href: string): string =>
    options?.tenantCompanyId != null
      ? operatorTenantHref(href, options.tenantCompanyId)
      : href;

  switch (type) {
    case 'ticket':
      return {
        href: withTenant(`/tickets/${resourceId}`),
        label: `Ticket #${resourceId}`,
      };
    case 'invoice':
      // Invoice audits store the ticket id as resource_id.
      return {
        href: withTenant(`/tickets/${resourceId}`),
        label: `Recibo · Ticket #${resourceId}`,
      };
    case 'client':
      return {
        href: withTenant(`/clients/${resourceId}/edit`),
        label: `Cliente #${resourceId}`,
      };
    case 'service':
      return {
        href: withTenant(`/services/${resourceId}/edit`),
        label: `Servicio #${resourceId}`,
      };
    case 'company':
      return {
        href: withTenant(`/companies/${resourceId}/edit`),
        label: `Empresa #${resourceId}`,
      };
    case 'user':
      return {
        href: withTenant(`/users`),
        label: `Usuario #${resourceId}`,
      };
    default:
      return null;
  }
};

export type FormatAuditResourceLabelOptions = {
  actorName?: string | null;
  /** Payload-first human name (client, company, etc.). */
  displayName?: string | null;
};

export const formatAuditResourceLabel = (
  resourceType: string,
  resourceId: string | null | undefined,
  options: FormatAuditResourceLabelOptions = {},
): string => {
  const typeLabel = formatAuditResourceTypeLabel(resourceType);
  const displayName = options.displayName?.trim() || null;

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

  if (resourceType === 'ticket' || resourceType === 'invoice') {
    if (resourceId && isPlainPositiveInteger(resourceId)) {
      const ticketPart =
        resourceType === 'invoice'
          ? `Recibo · Ticket #${resourceId}`
          : `Ticket #${resourceId}`;
      return displayName ? `${ticketPart} · ${displayName}` : ticketPart;
    }
    if (displayName) {
      return resourceType === 'invoice'
        ? `Recibo · ${displayName}`
        : `Ticket · ${displayName}`;
    }
  }

  if (!resourceId) {
    return displayName ? `${typeLabel} · ${displayName}` : typeLabel;
  }

  if (isPlainPositiveInteger(resourceId)) {
    const withId = `${typeLabel} #${resourceId}`;
    return displayName ? `${withId} · ${displayName}` : withId;
  }

  return displayName
    ? `${typeLabel} · ${displayName}`
    : `${typeLabel} · ${resourceId}`;
};

export type AuditSummaryResourcePresentation = {
  /** Secondary line under Resumen; null when it would only repeat the title. */
  subtitle: string | null;
  href: string | null;
  /** When true, wrap the summary title in the resource link (no separate blue line). */
  linkTitle: boolean;
};

/**
 * Decide whether Resumen needs a blue secondary line.
 * When the title already mentions the ticket/resource id (and any display name),
 * hide the subtitle and optionally link the title instead.
 */
export const resolveAuditSummaryResourcePresentation = (input: {
  title: string;
  resourceType: string;
  resourceId: string | null | undefined;
  payload?: Record<string, unknown> | null;
  actorName?: string | null;
}): AuditSummaryResourcePresentation => {
  const link = resolveAuditResourceLink(input.resourceType, input.resourceId);
  const displayName =
    input.payload != null
      ? resolveAuditResourceDisplayName(input.payload)
      : null;
  const fullLabel = formatAuditResourceLabel(
    input.resourceType,
    input.resourceId,
    { actorName: input.actorName, displayName },
  );

  const resourceId = input.resourceId?.trim() || null;
  const idInTitle = Boolean(
    resourceId && input.title.includes(`#${resourceId}`),
  );
  const nameInTitle = Boolean(
    displayName &&
      (input.title.includes(`"${displayName}"`) ||
        input.title.includes(displayName)),
  );

  if (idInTitle) {
    if (displayName && !nameInTitle) {
      const subtitle =
        input.resourceType === 'ticket' || input.resourceType === 'invoice'
          ? `Cliente · ${displayName}`
          : displayName;
      return {
        subtitle,
        href: link?.href ?? null,
        linkTitle: false,
      };
    }
    return {
      subtitle: null,
      href: link?.href ?? null,
      linkTitle: Boolean(link?.href),
    };
  }

  if (nameInTitle && !resourceId) {
    return {
      subtitle: null,
      href: link?.href ?? null,
      linkTitle: Boolean(link?.href),
    };
  }

  return {
    subtitle: fullLabel,
    href: link?.href ?? null,
    linkTitle: false,
  };
};
