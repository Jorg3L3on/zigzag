import { requireActionPermission } from '@/lib/security';
import {
  USERS_READ_PERMISSION,
  USERS_WRITE_PERMISSION,
} from '@/lib/users-rbac';

export const requireUserRead = async (companyId?: number | null) =>
  requireActionPermission(USERS_READ_PERMISSION, companyId ?? undefined);

export const requireUserWrite = async (companyId?: number | null) =>
  requireActionPermission(USERS_WRITE_PERMISSION, companyId ?? undefined);
