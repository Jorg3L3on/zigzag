import { GET } from '@/app/api/tickets/[id]/route';
import { getTicketById } from '@/actions/tickets';
import { requireApiPermission } from '@/lib/api-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/actions/tickets', () => ({
  getTicketById: jest.fn(),
}));

const mockRequireApiPermission =
  requireApiPermission as jest.MockedFunction<typeof requireApiPermission>;
const mockGetTicketById = getTicketById as jest.MockedFunction<
  typeof getTicketById
>;

const makeGetRequest = (url: string) => ({ url }) as Request;
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/tickets/[id]', () => {
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
      makeGetRequest('http://localhost/api/tickets/42'),
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
  });

  it('returns ticket payload for authorized tenant users', async () => {
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
      data: { id: 42, company_id: 10, total: 100 },
    });

    const response = await GET(
      makeGetRequest('http://localhost/api/tickets/42?company_id=10'),
      makeContext('42'),
    );

    expect(response.status).toBe(200);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('tickets.read', 10);
    expect(mockGetTicketById).toHaveBeenCalledWith(42, 10);
  });

  it('allows system company users to read cross-tenant tickets', async () => {
    mockRequireApiPermission.mockResolvedValue({
      session: {
        user: {
          id: '1',
          company_id: 1,
          company_is_system: true,
        },
      },
      companyId: 99,
      unauthorized: null,
    });
    mockGetTicketById.mockResolvedValue({
      success: true,
      data: { id: 42, company_id: 99, total: 250 },
    });

    const response = await GET(
      makeGetRequest('http://localhost/api/tickets/42?company_id=99'),
      makeContext('42'),
    );

    expect(response.status).toBe(200);
    expect(mockGetTicketById).toHaveBeenCalledWith(42, 99);
  });
});
