import { NextResponse } from 'next/server';
import { loadDashboardMetricsForCompany } from '@/actions/dashboard';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import { fail, requireApiPermission } from '@/lib/api-helpers';
import { isErrorCode } from '@/lib/error-catalog';
import {
  buildDashboardReportFileName,
  buildDashboardReportPayload,
} from '@/lib/dashboard-report-payload';
import { renderDashboardReportPdf } from '@/lib/dashboard-report-renderer';
import { parseDashboardMonthCount } from '@/lib/dashboard-metrics';
import { and, eq, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedCompanyId = url.searchParams.get('company_id');
    const parsedCompanyId = requestedCompanyId
      ? Number.parseInt(requestedCompanyId, 10)
      : undefined;
    const monthCount = parseDashboardMonthCount(
      url.searchParams.get('monthCount'),
    );

    const { session, unauthorized } = await requireApiPermission(
      'tickets.read',
      parsedCompanyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    let effectiveCompanyId = session.user.company_id;
    if (session.user.company_is_system && parsedCompanyId != null) {
      effectiveCompanyId = parsedCompanyId;
    }

    if (
      !session.user.company_is_system &&
      parsedCompanyId != null &&
      parsedCompanyId !== session.user.company_id
    ) {
      return fail('AU002', 403, 'auth');
    }

    const metricsResult = await loadDashboardMetricsForCompany(
      effectiveCompanyId,
      monthCount,
    );

    if (!metricsResult.success || !metricsResult.data) {
      const code =
        metricsResult.error && isErrorCode(metricsResult.error)
          ? metricsResult.error
          : 'DB001';
      return fail(code, 500, metricsResult.errorType || 'server');
    }

    const [companyRow] = await db
      .select()
      .from(company)
      .where(
        and(eq(company.id, effectiveCompanyId), isNull(company.deleted_at)),
      )
      .limit(1);

    if (!companyRow) {
      return fail('CO006', 404, 'validation');
    }

    const generatedAt = new Date();
    const payload = buildDashboardReportPayload(
      companyRow,
      metricsResult.data,
      generatedAt,
    );
    const pdf = renderDashboardReportPdf(payload);
    const filename = buildDashboardReportFileName(generatedAt);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating dashboard report PDF:', error);
    return fail('PDF001', 500, 'server');
  }
}
