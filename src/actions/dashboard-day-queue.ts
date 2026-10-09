'use server';

import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { DashboardDayQueue } from '@/lib/dashboard-day-queue';
import { loadDashboardDayQueueForCompany } from '@/lib/dashboard-day-queue-loader';
import { requireTicketRead } from '@/lib/tickets-rbac-server';

/** Inicio «Tu día» for the caller's company (system users pass the selected one). */
export async function getDashboardDayQueue(
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: DashboardDayQueue;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );
    const data = await loadDashboardDayQueueForCompany(effectiveCompanyId);
    return { success: true, data };
  } catch (e) {
    return handleCodedServerActionError('dashboard.dayQueue', 'TC002', e);
  }
}
