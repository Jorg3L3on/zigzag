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
import { recordDocumentGeneratedAudit } from '@/lib/resource-audit';
import { toCsv } from '@/lib/csv';
import { captureException } from '@/lib/observability';
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

    await recordDocumentGeneratedAudit({
      actor: {
        userId: session.user.id,
        companyId: session.user.company_id ?? null,
        companyIsSystem: Boolean(session.user.company_is_system),
      },
      resourceType: 'report',
      resourceId: effectiveCompanyId,
      targetCompanyId: effectiveCompanyId,
      requestMeta: { route: '/api/dashboard/report', method: 'GET' },
    });

    if (url.searchParams.get('format') === 'csv') {
      const revenueCsv = toCsv(
        ['periodo', 'ingresos'],
        payload.revenueRows.map((row) => ({
          periodo: row.label,
          ingresos: row.amountLabel,
        })),
      );
      const paymentCsv = toCsv(
        ['estado', 'cantidad', 'monto'],
        payload.paymentRows.map((row) => ({
          estado: row.label,
          cantidad: row.count,
          monto: row.amountLabel,
        })),
      );
      const csv = `\ufeffIngresos por mes\r\n${revenueCsv}\r\n\r\nEstado de cobro\r\n${paymentCsv}\r\n`;
      const csvName = buildDashboardReportFileName(generatedAt).replace(
        /\.pdf$/,
        '.csv',
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="${csvName.replace(/"/g, '')}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

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
    captureException(error, { route: '/api/dashboard/report' });
    return fail('PDF001', 500, 'server');
  }
}
