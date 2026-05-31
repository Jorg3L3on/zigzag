import { requireActionPermission } from '@/lib/security';
import {
  COMPANIES_READ_PERMISSION,
  COMPANIES_WRITE_PERMISSION,
} from '@/lib/companies-rbac';

export const requireCompanyRead = async (companyId?: number | null) =>
  requireActionPermission(COMPANIES_READ_PERMISSION, companyId ?? undefined);

export const requireCompanyWrite = async (companyId?: number | null) =>
  requireActionPermission(COMPANIES_WRITE_PERMISSION, companyId ?? undefined);
