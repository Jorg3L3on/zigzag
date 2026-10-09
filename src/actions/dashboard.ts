'use server';

import { auth } from '@/lib/auth';
import { buildActionError } from '@/lib/errors';
import {
  parseDashboardMonthCount,
  type DashboardMonthCount,
} from '@/lib/dashboard-metrics';
import {
  loadDashboardMetricsForCompany,
  type DashboardMetricsResponse,
} from '@/lib/dashboard-metrics-loader';
import { checkPermission } from '@/lib/security';
import { createCompanyCache } from '@/lib/cache';
import { withSpan } from '@/lib/observability';

export type {
  DashboardMetrics,
  DashboardMetricsResponse,
  DashboardRecentTicket,
} from '@/lib/dashboard-metrics-loader';

export type FetchDashboardMetricsInput = {
  /** When the user is a system admin, load metrics for this company. Ignored for normal users. */
  companyId?: number;
  monthCount?: DashboardMonthCount;
};

/**
 * Read-through cached variant. Dashboard data is display-only and tolerant of
 * brief staleness, so it is cached per company (tag `company:{id}:dashboard`)
 * and invalidated by ticket mutations via `invalidateCompanyCache`.
 */
const loadDashboardMetricsCached = createCompanyCache(
  (companyId: number, monthCount: DashboardMonthCount) =>
    withSpan(
      'dashboard.load',
      () => loadDashboardMetricsForCompany(companyId, monthCount),
      { companyId, monthCount },
    ),
  'dashboard',
);

/**
 * Loads dashboard metrics for the authenticated user.
 * Non-system users are always scoped to `session.user.company_id`.
 * System users may pass `companyId` to view another company.
 */
export async function fetchDashboardMetrics(
  input: FetchDashboardMetricsInput = {},
): Promise<DashboardMetricsResponse> {
  const session = await auth();
  if (!session?.user?.company_id) {
    return buildActionError('AU001');
  }

  if (
    !session.user.company_is_system &&
    input.companyId != null &&
    input.companyId !== session.user.company_id
  ) {
    return buildActionError('AU002');
  }

  const monthCount = parseDashboardMonthCount(input.monthCount);

  let effectiveCompanyId = session.user.company_id;
  if (session.user.company_is_system && input.companyId != null) {
    effectiveCompanyId = input.companyId;
  }

  const allowed = await checkPermission(
    session.user.id,
    effectiveCompanyId,
    'tickets.read',
  );

  if (!allowed) {
    return buildActionError('AU002');
  }

  return loadDashboardMetricsCached(effectiveCompanyId, monthCount);
}
