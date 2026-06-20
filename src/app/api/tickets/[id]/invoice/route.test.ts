jest.mock('next/server', () => ({
  NextResponse: jest.fn((body, init) => ({
    status: init?.status ?? 200,
    body,
    headers: init?.headers ?? {},
  })),
}));

import { GET } from '@/app/api/tickets/[id]/invoice/route';
import { getTicketById } from '@/actions/tickets';
import { requireApiPermission } from '@/lib/api-helpers';
import { buildFintechInvoicePayload } from '@/lib/fintech-invoice-payload';
import { loadCompanyLogoImageDataUrl } from '@/lib/company-logo-branding-server';
import { renderFintechInvoicePdf } from '@/lib/fintech-invoice-renderer';
import { recordDocumentGeneratedAudit } from '@/lib/resource-audit';

jest.mock('@/lib/api-helpers', () => ({
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/actions/tickets', () => ({
  getTicketById: jest.fn(),
}));

jest.mock('@/lib/fintech-invoice-payload', () => ({
  buildFintechInvoicePayload: jest.fn(),
}));

jest.mock('@/lib/company-logo-branding-server', () => ({
  loadCompanyLogoImageDataUrl: jest.fn(),
}));

jest.mock('@/lib/fintech-invoice-renderer', () => ({
  renderFintechInvoicePdf: jest.fn(),
}));

jest.mock('@/lib/resource-audit', () => ({
  recordDocumentGeneratedAudit: jest.fn(),
}));

const mockRequireApiPermission =
  requireApiPermission as jest.MockedFunction<typeof requireApiPermission>;
const mockGetTicketById = getTicketById as jest.MockedFunction<
  typeof getTicketById
>;
const mockBuildFintechInvoicePayload =
  buildFintechInvoicePayload as jest.MockedFunction<
    typeof buildFintechInvoicePayload
  >;
const mockLoadCompanyLogoImageDataUrl =
  loadCompanyLogoImageDataUrl as jest.MockedFunction<
    typeof loadCompanyLogoImageDataUrl
  >;
const mockRenderFintechInvoicePdf = renderFintechInvoicePdf as jest.MockedFunction<
  typeof renderFintechInvoicePdf
>;
const mockRecordDocumentGeneratedAudit =
  recordDocumentGeneratedAudit as jest.MockedFunction<
    typeof recordDocumentGeneratedAudit
  >;

const makeGetRequest = (url: string) => ({ url }) as Request;
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/tickets/[id]/invoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when tickets.read permission is denied', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: null,
      companyId: null,
      unauthorized: {
        body: { success: false, error: 'AU002', errorType: 'auth' },
        status: 403,
      },
    });

    const response = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice'),
      makeContext('42'),
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'AU002',
    });
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.read',
      undefined,
    );
    expect(mockGetTicketById).not.toHaveBeenCalled();
    expect(mockRenderFintechInvoicePdf).not.toHaveBeenCalled();
  });

  it('returns PDF for authorized users with tickets.read', async () => {
    const ticket = {
      id: 42,
      company_id: 10,
      total: 100,
      client: { name: 'Acme' },
    };

    mockRequireApiPermission.mockResolvedValue({
      session: {
        user: {
          id: '7',
          company_id: 10,
          company_is_system: false,
        },
      },
      companyId: 10,
      unauthorized: null,
    });
    mockGetTicketById.mockResolvedValue({
      success: true,
      data: ticket,
    });
    mockBuildFintechInvoicePayload.mockReturnValue({
      issuer: { logoUrl: null },
    } as ReturnType<typeof buildFintechInvoicePayload>);
    mockLoadCompanyLogoImageDataUrl.mockResolvedValue(null);
    mockRenderFintechInvoicePdf.mockReturnValue(Buffer.from('pdf'));

    const response = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice?company_id=10'),
      makeContext('42'),
    );

    expect(response.status).toBe(200);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('tickets.read', 10);
    expect(mockGetTicketById).toHaveBeenCalledWith(42, 10);
    expect(mockRecordDocumentGeneratedAudit).toHaveBeenCalled();
  });
});
