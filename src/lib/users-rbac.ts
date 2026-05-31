import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';
import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

const base = createResourceRbacContract(
  PERMISSIONS.users.read,
  PERMISSIONS.users.write,
);

export const USERS_READ_PERMISSION = base.readPermission;
export const USERS_WRITE_PERMISSION = base.writePermission;
export const canReadUsers = base.canRead;
export const canWriteUsers = base.canWrite;

export const canManageUsers = (
  isSystem: boolean,
  canAccessPermission: CanAccessPermissionFn,
): boolean => isSystem && canWriteUsers(canAccessPermission);
