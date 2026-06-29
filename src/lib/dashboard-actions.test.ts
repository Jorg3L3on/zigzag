import { fetchDashboardMetrics } from '@/actions/dashboard';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/security';
import { IDOR_COMPANY_A, IDOR_COMPANY_B, buildIdorSession } from '@/test/idor-fixtures';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  createCompanyCache: jest.fn((loader) => loader),
}));

jest.mock('@/lib/observability', () => ({
  withSpan: jest.fn(async (_name, fn) => fn()),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;

describe('cross-tenant IDOR - dashboard actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchDashboardMetrics denies non-system cross-tenant company ids', async () => {
    mockAuth.mockResolvedValue(buildIdorSession(IDOR_COMPANY_B, '201'));

    const result = await fetchDashboardMetrics({
      companyId: IDOR_COMPANY_A.id,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AU002');
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });

  it('fetchDashboardMetrics checks permission on own tenant company', async () => {
    mockAuth.mockResolvedValue(buildIdorSession(IDOR_COMPANY_B, '201'));
    mockCheckPermission.mockResolvedValue(false);

    const result = await fetchDashboardMetrics({
      companyId: IDOR_COMPANY_B.id,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AU002');
    expect(mockCheckPermission).toHaveBeenCalledWith(
      '201',
      IDOR_COMPANY_B.id,
      'tickets.read',
    );
  });
});
