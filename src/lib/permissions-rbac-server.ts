import { requireActionPermission } from '@/lib/security';
import {
  PERMISSIONS_READ_PERMISSION,
  PERMISSIONS_WRITE_PERMISSION,
} from '@/lib/permissions-rbac';

export const requirePermissionRead = async (companyId?: number | null) =>
  requireActionPermission(PERMISSIONS_READ_PERMISSION, companyId ?? undefined);

export const requirePermissionWrite = async (companyId?: number | null) =>
  requireActionPermission(PERMISSIONS_WRITE_PERMISSION, companyId ?? undefined);
