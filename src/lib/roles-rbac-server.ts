import { requireActionPermission } from '@/lib/security';
import {
  ROLES_READ_PERMISSION,
  ROLES_WRITE_PERMISSION,
} from '@/lib/roles-rbac';

export const requireRoleRead = async (companyId?: number | null) =>
  requireActionPermission(ROLES_READ_PERMISSION, companyId ?? undefined);

export const requireRoleWrite = async (companyId?: number | null) =>
  requireActionPermission(ROLES_WRITE_PERMISSION, companyId ?? undefined);
