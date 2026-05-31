import { requireActionPermission } from '@/lib/security';
import {
  CLIENTS_READ_PERMISSION,
  CLIENTS_WRITE_PERMISSION,
} from '@/lib/clients-rbac';

export const requireClientRead = async (companyId?: number | null) =>
  requireActionPermission(CLIENTS_READ_PERMISSION, companyId ?? undefined);

export const requireClientWrite = async (companyId?: number | null) =>
  requireActionPermission(CLIENTS_WRITE_PERMISSION, companyId ?? undefined);
