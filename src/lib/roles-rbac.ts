import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';
import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

const base = createResourceRbacContract(
  PERMISSIONS.roles.read,
  PERMISSIONS.roles.write,
);

export const ROLES_READ_PERMISSION = base.readPermission;
export const ROLES_WRITE_PERMISSION = base.writePermission;
export const canReadRoles = base.canRead;
export const canWriteRoles = base.canWrite;

export const canManageRoles = (
  isSystem: boolean,
  canAccessPermission: CanAccessPermissionFn,
): boolean => isSystem && canWriteRoles(canAccessPermission);
