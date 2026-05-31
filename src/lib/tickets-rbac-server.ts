import { requireActionPermission } from '@/lib/security';
import {
  TICKETS_READ_PERMISSION,
  TICKETS_WRITE_PERMISSION,
} from '@/lib/tickets-rbac';

export const requireTicketRead = async (companyId?: number | null) =>
  requireActionPermission(TICKETS_READ_PERMISSION, companyId ?? undefined);

export const requireTicketWrite = async (companyId?: number | null) =>
  requireActionPermission(TICKETS_WRITE_PERMISSION, companyId ?? undefined);
