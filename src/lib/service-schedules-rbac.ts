import { PERMISSIONS } from '@/lib/permissions';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';

/**
 * Service Schedules contract:
 * - Read access is governed by tickets.read.
 * - Write access accepts either tickets.write or clients.write.
 * - Ticket creation from schedule surfaces requires tickets.write.
 * - System company users must provide selected company context for schedule data.
 */
export const SERVICE_SCHEDULES_READ_PERMISSION = PERMISSIONS.tickets.read;

export const SERVICE_SCHEDULES_WRITE_PERMISSIONS = [
  PERMISSIONS.tickets.write,
  PERMISSIONS.clients.write,
] as const;

export type CanAccessPermissionFn = (permission?: string) => boolean;

export const canReadServiceSchedules = (
  canAccessPermission: CanAccessPermissionFn,
): boolean => canAccessPermission(SERVICE_SCHEDULES_READ_PERMISSION);

export const canWriteServiceSchedules = (
  canAccessPermission: CanAccessPermissionFn,
): boolean =>
  SERVICE_SCHEDULES_WRITE_PERMISSIONS.some((permission) =>
    canAccessPermission(permission),
  );

export const canCreateTicketFromSchedule = (
  canAccessPermission: CanAccessPermissionFn,
): boolean => canAccessPermission(PERMISSIONS.tickets.write);

export const needsSelectedCompanyForSchedules = needsSelectedCompanyContext;
