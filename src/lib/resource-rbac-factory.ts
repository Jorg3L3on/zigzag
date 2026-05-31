import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

export type ResourceRbacContract = {
  readPermission: string;
  writePermission: string;
  canRead: (canAccessPermission: CanAccessPermissionFn) => boolean;
  canWrite: (canAccessPermission: CanAccessPermissionFn) => boolean;
};

export const createResourceRbacContract = (
  readPermission: string,
  writePermission: string,
): ResourceRbacContract => ({
  readPermission,
  writePermission,
  canRead: (canAccessPermission) => canAccessPermission(readPermission),
  canWrite: (canAccessPermission) => canAccessPermission(writePermission),
});
