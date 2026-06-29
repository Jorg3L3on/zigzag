import { GET } from '@/app/api/audit/events/route';
import { requireSession } from '@/lib/api-helpers';
import { queryAuditEvents } from '@/lib/audit-query';
import { IDOR_COMPANY_A, IDOR_COMPANY_B, buildIdorSession } from '@/test/idor-fixtures';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireSession: jest.fn(),
}));

jest.mock('@/lib/audit-query', () => ({
  queryAuditEvents: jest.fn(),
  searchAuditEvents: jest.fn(),
}));

const mockRequireSession = requireSession as jest.MockedFunction<
  typeof requireSession
>;
const mockQueryAuditEvents = queryAuditEvents as jest.MockedFunction<
  typeof queryAuditEvents
>;

const makeGetRequest = (url: string) => ({ url }) as Request;

describe('GET /api/audit/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-system authenticated users', async () => {
    mockRequireSession.mockResolvedValue({
      session: buildIdorSession(IDOR_COMPANY_B, '201'),
      unauthorized: undefined,
    });

    const response = await GET(
      makeGetRequest('http://localhost/api/audit/events'),
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'AU002',
    });
    expect(mockQueryAuditEvents).not.toHaveBeenCalled();
  });

  it('denies non-system cross-tenant audit filters', async () => {
    mockRequireSession.mockResolvedValue({
      session: buildIdorSession(IDOR_COMPANY_B, '201'),
      unauthorized: undefined,
    });

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/audit/events?target_company_id=${IDOR_COMPANY_A.id}`,
      ),
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'AU002',
    });
    expect(mockQueryAuditEvents).not.toHaveBeenCalled();
  });

  it('returns filtered audit rows for system company users', async () => {
    mockRequireSession.mockResolvedValue({
      session: {
        user: {
          id: '1',
          company_id: 1,
          company_is_system: true,
        },
      },
      unauthorized: undefined,
    });
    mockQueryAuditEvents.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await GET(
      makeGetRequest(
        'http://localhost/api/audit/events?target_company_id=2&result=denied',
      ),
    );

    expect(response.status).toBe(200);
    expect(mockQueryAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCompanyId: 2,
        result: 'denied',
      }),
    );
  });
});
