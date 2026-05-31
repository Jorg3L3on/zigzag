import { PERMISSIONS } from '@/lib/permissions';
import { createResourceRbacContract } from '@/lib/resource-rbac-factory';
import type { CanAccessPermissionFn } from '@/lib/service-schedules-rbac';

const base = createResourceRbacContract(
  PERMISSIONS.companies.read,
  PERMISSIONS.companies.write,
);

export const COMPANIES_READ_PERMISSION = base.readPermission;
export const COMPANIES_WRITE_PERMISSION = base.writePermission;
export const canReadCompanies = base.canRead;
export const canWriteCompanies = base.canWrite;

/** Company admin mutations require System company membership plus write permission. */
export const canManageCompanies = (
  isSystem: boolean,
  canAccessPermission: CanAccessPermissionFn,
): boolean => isSystem && canWriteCompanies(canAccessPermission);
