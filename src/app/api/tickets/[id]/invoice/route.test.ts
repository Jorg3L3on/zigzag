jest.mock('next/server', () => ({
  NextResponse: jest.fn((body, init) => ({
    status: init?.status ?? 200,
    body,
    headers: init?.headers ?? {},
  })),
}));

import { GET } from '@/app/api/tickets/[id]/invoice/route';
import { buildReceiptPdfEtag } from '@/lib/receipt-pdf/etag';
import { getTicketById } from '@/actions/tickets';
import { requireApiPermission } from '@/lib/api-helpers';
import { buildReceiptPdfPayload } from '@/lib/receipt-pdf/payload';
import { loadCompanyLogoImageDataUrl } from '@/lib/company-logo-branding-server';
import { renderReceiptPdf } from '@/lib/receipt-pdf/render';
import { recordDocumentGeneratedAudit } from '@/lib/resource-audit';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
} from '@/test/cross-tenant-helpers';

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

jest.mock('@/lib/receipt-pdf/payload', () => ({
  buildReceiptPdfPayload: jest.fn(),
}));

jest.mock('@/lib/company-logo-branding-server', () => ({
  loadCompanyLogoImageDataUrl: jest.fn(),
}));

jest.mock('@/lib/receipt-pdf/render', () => ({
  RECEIPT_PDF_RENDERER_VERSION: 'test',
  renderReceiptPdf: jest.fn(),
}));

jest.mock('@/lib/resource-audit', () => ({
  recordDocumentGeneratedAudit: jest.fn(),
}));

const mockRequireApiPermission =
  requireApiPermission as jest.MockedFunction<typeof requireApiPermission>;
const mockGetTicketById = getTicketById as jest.MockedFunction<
  typeof getTicketById
>;
const mockBuildReceiptPdfPayload =
  buildReceiptPdfPayload as jest.MockedFunction<typeof buildReceiptPdfPayload>;
const mockLoadCompanyLogoImageDataUrl =
  loadCompanyLogoImageDataUrl as jest.MockedFunction<
    typeof loadCompanyLogoImageDataUrl
  >;
const mockRenderReceiptPdf = renderReceiptPdf as jest.MockedFunction<
  typeof renderReceiptPdf
>;
const mockRecordDocumentGeneratedAudit =
  recordDocumentGeneratedAudit as jest.MockedFunction<
    typeof recordDocumentGeneratedAudit
  >;

const makeGetRequest = (url: string, headers: Record<string, string> = {}) =>
  ({
    url,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  }) as unknown as Request;
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
    expect(mockRenderReceiptPdf).not.toHaveBeenCalled();
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
    mockBuildReceiptPdfPayload.mockReturnValue({
      company: { logoUrl: null },
    } as ReturnType<typeof buildReceiptPdfPayload>);
    mockLoadCompanyLogoImageDataUrl.mockResolvedValue(null);
    mockRenderReceiptPdf.mockReturnValue(new ArrayBuffer(3));

    const response = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice?company_id=10'),
      makeContext('42'),
    );

    expect(response.status).toBe(200);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('tickets.read', 10);
    expect(mockGetTicketById).toHaveBeenCalledWith(42, 10);
    expect(mockRecordDocumentGeneratedAudit).toHaveBeenCalled();
  });

  it('serves the PDF inline for previews when disposition=inline', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: { user: { id: '7', company_id: 10, company_is_system: false } },
      companyId: 10,
      unauthorized: null,
    });
    mockGetTicketById.mockResolvedValue({
      success: true,
      data: { id: 42, company_id: 10, total: 100, client: { name: 'Acme' } },
    });
    mockBuildReceiptPdfPayload.mockReturnValue({
      company: { logoUrl: null },
    } as ReturnType<typeof buildReceiptPdfPayload>);
    mockLoadCompanyLogoImageDataUrl.mockResolvedValue(null);
    mockRenderReceiptPdf.mockReturnValue(new ArrayBuffer(3));

    const inline = await GET(
      makeGetRequest(
        'http://localhost/api/tickets/42/invoice?company_id=10&disposition=inline',
      ),
      makeContext('42'),
    );
    const headersOf = (response: unknown) =>
      (response as { headers: Record<string, string> }).headers;
    expect(headersOf(inline)['Content-Disposition']).toMatch(/^inline; /);

    const attachment = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice?company_id=10'),
      makeContext('42'),
    );
    expect(headersOf(attachment)['Content-Disposition']).toMatch(/^attachment; /);
  });

  it('returns 403 when Company B requests Company A invoice context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/tickets/${IDOR_RESOURCES_A.ticketId}/invoice?company_id=${IDOR_COMPANY_A.id}`,
      ),
      makeContext(String(IDOR_RESOURCES_A.ticketId)),
    );

    expect(response.status).toBe(403);
    expect(mockGetTicketById).not.toHaveBeenCalled();
    expect(mockRenderReceiptPdf).not.toHaveBeenCalled();
  });

  it('returns 404 when Company B requests foreign Company A ticket invoice', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockGetTicketById.mockResolvedValue({
      success: false,
      error: 'Ticket not found',
      errorCode: 'TC008',
      errorType: 'validation',
    });

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/tickets/${IDOR_RESOURCES_A.ticketId}/invoice?company_id=${IDOR_COMPANY_B.id}`,
      ),
      makeContext(String(IDOR_RESOURCES_A.ticketId)),
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'TC008' });
    expect(mockRenderReceiptPdf).not.toHaveBeenCalled();
  });
});

describe('GET /api/tickets/[id]/invoice — ETag (ZIG-I20-4)', () => {
  const session = {
    session: { user: { id: '7', company_id: 10, company_is_system: false } },
    companyId: 10,
    unauthorized: null,
  };
  const ticket = { id: 42, company_id: 10, total: 100, client: { name: 'Acme' } };
  const payload = (overrides: Record<string, unknown> = {}) =>
    ({
      company: { logoUrl: null },
      total: 100,
      paid: 0,
      items: [{ name: 'Servicio', amount: 100 }],
      ...overrides,
    }) as unknown as ReturnType<typeof buildReceiptPdfPayload>;
  const headersOf = (response: unknown) =>
    (response as { headers: Record<string, string> }).headers;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireApiPermission.mockResolvedValue(session);
    mockGetTicketById.mockResolvedValue({ success: true, data: ticket });
    mockLoadCompanyLogoImageDataUrl.mockResolvedValue(null);
    mockRenderReceiptPdf.mockReturnValue(new ArrayBuffer(3));
  });

  it('answers a repeat request with 304 and no render, private cache control', async () => {
    mockBuildReceiptPdfPayload.mockReturnValue(payload());
    const first = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice?company_id=10'),
      makeContext('42'),
    );
    expect(first.status).toBe(200);
    const etag = headersOf(first).ETag;
    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(headersOf(first)['Cache-Control']).toBe('private, no-cache');
    expect(mockRenderReceiptPdf).toHaveBeenCalledTimes(1);
    expect(mockRecordDocumentGeneratedAudit).toHaveBeenCalledTimes(1);

    const second = await GET(
      makeGetRequest('http://localhost/api/tickets/42/invoice?company_id=10', {
        'if-none-match': `W/${etag}`,
      }),
      makeContext('42'),
    );
    expect(second.status).toBe(304);
    expect(headersOf(second).ETag).toBe(etag);
    expect(headersOf(second)['Cache-Control']).toBe('private, no-cache');
    expect(mockRenderReceiptPdf).toHaveBeenCalledTimes(1);
    expect(mockLoadCompanyLogoImageDataUrl).toHaveBeenCalledTimes(1);
    expect(mockRecordDocumentGeneratedAudit).toHaveBeenCalledTimes(1);
    // Authorization still runs before the 304.
    expect(mockRequireApiPermission).toHaveBeenCalledTimes(2);
    expect(mockGetTicketById).toHaveBeenCalledTimes(2);
  });

  it('changes the tag with a payment, a line, the logo or the company data', () => {
    const base = buildReceiptPdfEtag(payload());
    expect(buildReceiptPdfEtag(payload())).toBe(base);
    expect(buildReceiptPdfEtag(payload({ paid: 50 }))).not.toBe(base);
    expect(
      buildReceiptPdfEtag(payload({ items: [{ name: 'Otro', amount: 100 }] })),
    ).not.toBe(base);
    expect(
      buildReceiptPdfEtag(payload({ company: { logoUrl: 'https://blob/logo-abc.png' } })),
    ).not.toBe(base);
    expect(
      buildReceiptPdfEtag(payload({ payment: { bank: 'BBVA', clabe: '002010077777777771' } })),
    ).not.toBe(base);
  });

  it('still refuses a foreign ticket even with a matching If-None-Match', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: { user: { id: '7', company_id: IDOR_COMPANY_B.id, company_is_system: false } },
      companyId: IDOR_COMPANY_B.id,
      unauthorized: null,
    });
    mockGetTicketById.mockResolvedValue({ success: true, data: { ...ticket, company_id: IDOR_COMPANY_A.id } });
    mockBuildReceiptPdfPayload.mockReturnValue(payload());
    const etag = buildReceiptPdfEtag(payload());

    const response = await GET(
      makeGetRequest(`http://localhost/api/tickets/42/invoice`, { 'if-none-match': etag }),
      makeContext('42'),
    );
    expect(response.status).toBe(403);
  });
});
