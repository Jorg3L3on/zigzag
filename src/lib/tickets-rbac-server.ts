import {
  requireActionPermission,
  requireTenantActionPermission,
} from '@/lib/security';
import {
  TICKETS_READ_PERMISSION,
  TICKETS_WRITE_PERMISSION,
} from '@/lib/tickets-rbac';

/** Ticket reads that may omit company for system loaders (e.g. getTicketById). */
export const requireTicketRead = async (companyId?: number | null) =>
  requireActionPermission(TICKETS_READ_PERMISSION, companyId ?? undefined);

/**
 * Ticket reads that require selected company for system operators
 * (exports, tenant-scoped lists).
 */
export const requireTenantTicketRead = async (companyId?: number | null) =>
  requireTenantActionPermission(TICKETS_READ_PERMISSION, companyId);

/** Ticket mutations: system operators must pass selected company. */
export const requireTicketWrite = async (companyId?: number | null) =>
  requireTenantActionPermission(TICKETS_WRITE_PERMISSION, companyId);
