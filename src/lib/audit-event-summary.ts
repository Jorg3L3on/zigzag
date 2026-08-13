import { formatCompactCurrency } from '@/lib/format-compact';
import {
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
} from '@/lib/audit-labels';
import { operatorIncidentLabel } from '@/lib/operator-audit-incidents';
import {
  buildTicketAuditUpdateDetails,
  extractTicketAuditAmount,
} from '@/lib/ticket-audit-display';

export type AuditEventSummaryInput = {
  actor_name?: string | null;
  /** @deprecated Prefer actor_name; kept for call-site flexibility. */
  actor_user_name?: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  result: string;
  payload: Record<string, unknown> | null;
  request_meta?: Record<string, unknown> | null;
};

export type AuditEventSummary = {
  title: string;
  details: string[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const pickName = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value) {
      return value;
    }
  }
  return null;
};

const actorLabel = (
  actorName: string | null | undefined,
  fallbackName?: string | null | undefined,
): string => actorName?.trim() || fallbackName?.trim() || 'Alguien';

const denialReasonLabel = (reason: string | null): string | null => {
  if (!reason) {
    return null;
  }
  if (reason === 'missing_permission') {
    return 'falta el permiso';
  }
  if (reason === 'invalid_company_context') {
    return 'contexto de empresa inválido';
  }
  if (reason === 'missing_credentials') {
    return 'credenciales faltantes';
  }
  if (reason === 'invalid_credentials') {
    return 'credenciales inválidas';
  }
  if (reason === 'throttled') {
    return 'demasiados intentos';
  }
  if (reason === 'inactive_company') {
    return 'empresa inactiva';
  }
  return reason;
};

const resourceDisplayName = (
  payload: Record<string, unknown> | null,
): string | null => {
  const after = asRecord(payload?.after);
  const before = asRecord(payload?.before);
  const ticket = asRecord(payload?.ticket);
  return pickName(
    after?.name,
    before?.name,
    ticket?.client_name,
    after?.client_name,
    before?.client_name,
  );
};

const quotedName = (name: string | null, fallback: string): string =>
  name ? `"${name}"` : fallback;

const formatTicketRef = (resourceId: string | null): string =>
  resourceId ? `#${resourceId}` : 'un ticket';

const buildGenericTitle = (input: AuditEventSummaryInput): string => {
  const who = actorLabel(input.actor_name, input.actor_user_name);
  const actionLabel = formatAuditActionLabel(input.action).toLowerCase();
  const resourceLabel = formatAuditResourceTypeLabel(
    input.resource_type,
  ).toLowerCase();
  const resourceId = input.resource_id ? ` #${input.resource_id}` : '';
  return `${who}: ${actionLabel} · ${resourceLabel}${resourceId}`;
};

/**
 * Spanish sentence-style summary for the auditoría console.
 * React-free so it can be reused in CSV export and tests.
 */
export const formatAuditEventSummary = (
  input: AuditEventSummaryInput,
): AuditEventSummary => {
  const who = actorLabel(input.actor_name, input.actor_user_name);
  const payload = input.payload;
  const name = resourceDisplayName(payload);
  const details: string[] = [];
  const ticketRef = formatTicketRef(input.resource_id);

  if (input.action === 'sign_in_failed' || (input.resource_type === 'auth' && input.result === 'failed')) {
    const email = asString(payload?.email);
    const reason = denialReasonLabel(asString(payload?.reason));
    const parts = [
      operatorIncidentLabel({
        action: input.action,
        result: input.result,
        resource_type: input.resource_type,
        payload,
      }),
    ];
    if (reason) {
      parts.push(reason);
    }
    if (email) {
      parts.push(email);
    }
    return { title: parts.join(' · '), details };
  }

  if (input.resource_type === 'auth' && input.action === 'signed_in') {
    const email = asString(payload?.email);
    if (email) {
      details.push(`Correo: ${email}`);
    }
    return { title: `${who} inició sesión`, details };
  }

  if (input.resource_type === 'auth' && input.action === 'signed_out') {
    return { title: `${who} cerró sesión`, details };
  }

  if (input.action === 'permission_denied' || input.resource_type === 'security') {
    const permission =
      asString(payload?.permission) ||
      (input.resource_id && !/^\d+$/.test(input.resource_id)
        ? input.resource_id
        : null);
    const reason = denialReasonLabel(asString(payload?.denial_reason));
    const title = permission
      ? `Denegado: ${permission}`
      : operatorIncidentLabel({
          action: input.action,
          result: input.result,
          resource_type: input.resource_type,
          payload,
        });
    if (reason) {
      details.push(`Motivo: ${reason}`);
    }
    if (payload?.error_code) {
      details.push(`Código: ${String(payload.error_code)}`);
    }
    return { title, details };
  }

  if (input.resource_type === 'ticket') {
    if (input.action === 'updated') {
      details.push(...buildTicketAuditUpdateDetails(payload));
    }

    if (input.action === 'created') {
      const client = pickName(
        asRecord(payload?.ticket)?.client_name,
        asRecord(payload?.after)?.client_name,
      );
      if (client) {
        details.push(`Cliente: ${client}`);
      }
      return { title: `${who} creó el ticket ${ticketRef}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el ticket ${ticketRef}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el ticket ${ticketRef}`, details };
    }
    if (input.action === 'finished') {
      const amount = extractTicketAuditAmount('finished', payload);
      if (amount != null && amount > 0) {
        return {
          title: `${who} finalizó el ticket ${ticketRef} con un pago de ${formatCompactCurrency(amount)}`,
          details,
        };
      }
      return { title: `${who} finalizó el ticket ${ticketRef}`, details };
    }
    if (input.action === 'payment_collected') {
      const amount = extractTicketAuditAmount('payment_collected', payload);
      if (amount != null) {
        return {
          title: `${who} registró un pago de ${formatCompactCurrency(amount)} en el ticket ${ticketRef}`,
          details,
        };
      }
      return {
        title: `${who} registró un pago en el ticket ${ticketRef}`,
        details,
      };
    }
    if (input.action === 'presupuesto_converted') {
      return {
        title: `${who} convirtió el presupuesto ${ticketRef}`,
        details,
      };
    }
    if (input.action === 'presupuesto_canceled') {
      return {
        title: `${who} canceló el presupuesto ${ticketRef}`,
        details,
      };
    }
  }

  if (input.resource_type === 'invoice' && input.action === 'generated') {
    return {
      title: `${who} generó el recibo del ticket ${ticketRef}`,
      details: ['Comprobante PDF generado'],
    };
  }

  if (input.resource_type === 'report' && input.action === 'generated') {
    return { title: `${who} generó un informe`, details };
  }

  if (input.resource_type === 'client') {
    const label = quotedName(name, 'un cliente');
    if (input.action === 'created') {
      return { title: `${who} creó el cliente ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el cliente ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el cliente ${label}`, details };
    }
  }

  if (input.resource_type === 'service') {
    const label = quotedName(name, 'un servicio');
    if (input.action === 'created') {
      return { title: `${who} creó el servicio ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el servicio ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el servicio ${label}`, details };
    }
  }

  if (input.resource_type === 'user') {
    const label = quotedName(name, 'un usuario');
    if (input.action === 'created') {
      return { title: `${who} creó el usuario ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el usuario ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el usuario ${label}`, details };
    }
  }

  if (input.resource_type === 'company') {
    const label = quotedName(name, 'una empresa');
    if (input.action === 'created') {
      return { title: `${who} creó la empresa ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó la empresa ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó la empresa ${label}`, details };
    }
    if (input.action === 'logo_uploaded') {
      return { title: `${who} subió el logo de ${label}`, details };
    }
    if (input.action === 'logo_removed') {
      return { title: `${who} eliminó el logo de ${label}`, details };
    }
    if (input.action === 'export_generated') {
      const after = asRecord(payload?.after);
      const counts = asRecord(after?.counts);
      if (counts) {
        details.push(
          `Conteos: ${Object.entries(counts)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(', ')}`,
        );
      }
      return { title: `${who} exportó datos de ${label}`, details };
    }
    if (input.action === 'offboarded') {
      return { title: `${who} dio de baja la empresa ${label}`, details };
    }
  }

  if (input.resource_type === 'role') {
    const label = quotedName(name, 'un rol');
    if (input.action === 'permission_assigned') {
      const permissionName = pickName(
        asRecord(payload?.after)?.permission
          ? asRecord(asRecord(payload?.after)?.permission)?.name
          : null,
        asRecord(payload?.after)?.name,
      );
      details.push(
        permissionName
          ? `Permiso: ${permissionName}`
          : 'Permiso asignado al rol',
      );
      return { title: `${who} asignó un permiso al rol ${label}`, details };
    }
    if (input.action === 'permission_removed') {
      return { title: `${who} quitó un permiso del rol ${label}`, details };
    }
    if (input.action === 'created') {
      return { title: `${who} creó el rol ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el rol ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el rol ${label}`, details };
    }
  }

  if (input.resource_type === 'permission') {
    const label = quotedName(name, 'un permiso');
    if (input.action === 'created') {
      return { title: `${who} creó el permiso ${label}`, details };
    }
    if (input.action === 'updated') {
      return { title: `${who} actualizó el permiso ${label}`, details };
    }
    if (input.action === 'deleted') {
      return { title: `${who} eliminó el permiso ${label}`, details };
    }
  }

  const route = asString(input.request_meta?.route);
  const method = asString(input.request_meta?.method);
  if (route) {
    details.push(method ? `${method} ${route}` : `Ruta: ${route}`);
  }

  return { title: buildGenericTitle(input), details };
};

export const hasRequestMetaContent = (
  requestMeta: Record<string, unknown> | null | undefined,
): boolean => {
  if (!requestMeta) {
    return false;
  }
  return Object.keys(requestMeta).length > 0;
};
