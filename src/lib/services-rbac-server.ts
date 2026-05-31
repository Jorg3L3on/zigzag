import { requireActionPermission } from '@/lib/security';
import {
  SERVICES_READ_PERMISSION,
  SERVICES_WRITE_PERMISSION,
} from '@/lib/services-rbac';

export const requireServiceRead = async (companyId?: number | null) =>
  requireActionPermission(SERVICES_READ_PERMISSION, companyId ?? undefined);

export const requireServiceWrite = async (companyId?: number | null) =>
  requireActionPermission(SERVICES_WRITE_PERMISSION, companyId ?? undefined);
