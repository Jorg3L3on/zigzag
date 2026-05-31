import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';
import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

const base = createResourceRbacContract(
  PERMISSIONS.permissions.read,
  PERMISSIONS.permissions.write,
);

export const PERMISSIONS_READ_PERMISSION = base.readPermission;
export const PERMISSIONS_WRITE_PERMISSION = base.writePermission;
export const canReadPermissions = base.canRead;
export const canWritePermissions = base.canWrite;

export const canManagePermissions = (
  isSystem: boolean,
  canAccessPermission: CanAccessPermissionFn,
): boolean => isSystem && canWritePermissions(canAccessPermission);
