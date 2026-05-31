import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';
import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

/**
 * Tickets contract:
 * - Read: tickets.read (required for page access and invoice download)
 * - Write: tickets.write (edit, finish, payment, services assignment)
 * - Edge policy: write-only roles cannot reach read-guarded pages; mutations require write.
 */
const base = createResourceRbacContract(
  PERMISSIONS.tickets.read,
  PERMISSIONS.tickets.write,
);

export const TICKETS_READ_PERMISSION = base.readPermission;
export const TICKETS_WRITE_PERMISSION = base.writePermission;
export const canReadTickets = base.canRead;
export const canWriteTickets = base.canWrite;

export const canEditTicket = (canAccessPermission: CanAccessPermissionFn): boolean =>
  canWriteTickets(canAccessPermission);

export const canFinishTicket = (canAccessPermission: CanAccessPermissionFn): boolean =>
  canWriteTickets(canAccessPermission);

export const canCollectTicketPayment = (
  canAccessPermission: CanAccessPermissionFn,
): boolean => canWriteTickets(canAccessPermission);

export const canDownloadTicketInvoice = (
  canAccessPermission: CanAccessPermissionFn,
): boolean => canReadTickets(canAccessPermission);

export const canAssignTicketServices = (
  canAccessPermission: CanAccessPermissionFn,
): boolean => canWriteTickets(canAccessPermission);
