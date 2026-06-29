jest.mock('next/server', () => ({
  NextResponse: jest.fn((body, init) => ({
    status: init?.status ?? 200,
    body,
    headers: init?.headers ?? {},
  })),
}));

import { GET } from '@/app/api/dashboard/report/route';
import { loadDashboardMetricsForCompany } from '@/actions/dashboard';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { parseDashboardMonthCount } from '@/lib/dashboard-metrics';
import {
  buildDashboardReportFileName,
  buildDashboardReportPayload,
} from '@/lib/dashboard-report-payload';
import { toCsv } from '@/lib/csv';
import { recordDocumentGeneratedAudit } from '@/lib/resource-audit';
import { IDOR_COMPANY_A, IDOR_COMPANY_B, buildIdorSession } from '@/test/idor-fixtures';

jest.mock('@/lib/api-helpers', () => ({
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/actions/dashboard', () => ({
  loadDashboardMetricsForCompany: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: { select: jest.fn() },
}));

jest.mock('@/lib/dashboard-metrics', () => ({
  parseDashboardMonthCount: jest.fn(() => 6),
}));

jest.mock('@/lib/dashboard-report-payload', () => ({
  buildDashboardReportFileName: jest.fn(() => 'dashboard-report.pdf'),
  buildDashboardReportPayload: jest.fn(),
}));

jest.mock('@/lib/dashboard-report-renderer', () => ({
  renderDashboardReportPdf: jest.fn(() => Buffer.from('pdf')),
}));

jest.mock('@/lib/resource-audit', () => ({
  recordDocumentGeneratedAudit: jest.fn(),
}));

jest.mock('@/lib/csv', () => ({
  toCsv: jest.fn(() => 'col1,col2'),
}));

jest.mock('@/lib/observability', () => ({
  captureException: jest.fn(),
}));

const mockRequireApiPermission =
  requireApiPermission as jest.MockedFunction<typeof requireApiPermission>;
const mockLoadDashboardMetricsForCompany =
  loadDashboardMetricsForCompany as jest.MockedFunction<
    typeof loadDashboardMetricsForCompany
  >;
const mockParseDashboardMonthCount =
  parseDashboardMonthCount as jest.MockedFunction<typeof parseDashboardMonthCount>;
const mockBuildDashboardReportPayload =
  buildDashboardReportPayload as jest.MockedFunction<typeof buildDashboardReportPayload>;
const mockBuildDashboardReportFileName =
  buildDashboardReportFileName as jest.MockedFunction<
    typeof buildDashboardReportFileName
  >;
const mockToCsv = toCsv as jest.MockedFunction<typeof toCsv>;
const mockRecordDocumentGeneratedAudit =
  recordDocumentGeneratedAudit as jest.MockedFunction<
    typeof recordDocumentGeneratedAudit
  >;

const mockDb = db as unknown as { select: jest.Mock };

const makeGetRequest = (url: string) => ({ url }) as Request;

const mockCompanyLookup = (row: { id: number; name: string } | undefined) => {
  const limit = jest.fn(async () => (row ? [row] : []));
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValue({ from });
};

describe('cross-tenant IDOR - /api/dashboard/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies non-system users requesting another company report', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: null,
      companyId: null,
      unauthorized: {
        status: 403,
        body: { success: false, error: 'AU002', errorType: 'auth' },
      },
    });

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/dashboard/report?company_id=${IDOR_COMPANY_A.id}`,
      ),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockLoadDashboardMetricsForCompany).not.toHaveBeenCalled();
  });

  it('scopes report generation to authorized tenant company', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: buildIdorSession(IDOR_COMPANY_B, '201'),
      companyId: IDOR_COMPANY_B.id,
      unauthorized: null,
    });
    mockParseDashboardMonthCount.mockReturnValue(6);
    mockLoadDashboardMetricsForCompany.mockResolvedValue({
      success: true,
      data: {
        revenueByMonth: [],
        paymentStatusBreakdown: [],
      },
    } as Awaited<ReturnType<typeof loadDashboardMetricsForCompany>>);
    mockCompanyLookup({ id: IDOR_COMPANY_B.id, name: IDOR_COMPANY_B.name });
    mockBuildDashboardReportPayload.mockReturnValue({
      revenueRows: [],
      paymentRows: [],
    } as ReturnType<typeof buildDashboardReportPayload>);
    mockBuildDashboardReportFileName.mockReturnValue('tenant-b-report.pdf');
    mockToCsv.mockReturnValue('h1,h2');

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/dashboard/report?company_id=${IDOR_COMPANY_B.id}&format=csv`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mockLoadDashboardMetricsForCompany).toHaveBeenCalledWith(
      IDOR_COMPANY_B.id,
      6,
    );
    expect(mockRecordDocumentGeneratedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCompanyId: IDOR_COMPANY_B.id,
      }),
    );
    expect(response.headers['Content-Type']).toContain('text/csv');
  });
});
