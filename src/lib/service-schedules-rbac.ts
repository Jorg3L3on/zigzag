import { PERMISSIONS } from '@/lib/permissions';

/**
 * Service Schedules contract:
 * - Read access is governed by tickets.read.
 * - Write access accepts either tickets.write or clients.write.
 */
export const SERVICE_SCHEDULES_READ_PERMISSION = PERMISSIONS.tickets.read;

export const SERVICE_SCHEDULES_WRITE_PERMISSIONS = [
  PERMISSIONS.tickets.write,
  PERMISSIONS.clients.write,
] as const;

export const canWriteServiceSchedules = (
  canAccessPermission: (permission?: string) => boolean,
): boolean =>
  SERVICE_SCHEDULES_WRITE_PERMISSIONS.some((permission) =>
    canAccessPermission(permission),
  );
