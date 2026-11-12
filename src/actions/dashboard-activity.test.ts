/**
 * @jest-environment node
 */
import { fetchDashboardActivity } from '@/actions/dashboard-activity';
import { auth } from '@/lib/auth';
import { queryAuditEvents } from '@/lib/audit-query';
import { AuthorizationError, PasswordChangeRequiredError } from '@/lib/errors';
import { checkPermission, requireActionAuth } from '@/lib/security';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/audit-query', () => ({ queryAuditEvents: jest.fn() }));
jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
  requireActionAuth: jest.fn(),
}));

const mockAuth = auth as unknown as jest.Mock;
const mockQuery = queryAuditEvents as jest.Mock;
const mockCheckPermission = checkPermission as jest.Mock;
const mockRequireActionAuth = requireActionAuth as jest.Mock;

describe('fetchDashboardActivity (ZIG-I36-9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuth.mockResolvedValue({
      user: { id: '7', company_id: 10, company_is_system: false },
    });
    mockCheckPermission.mockResolvedValue(true);
    mockQuery.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves the feed to a live session', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '7',
      companyId: 10,
      companyIsSystem: false,
    });

    const result = await fetchDashboardActivity();

    expect(result.success).toBe(true);
    expect(mockRequireActionAuth).toHaveBeenCalledTimes(1);
  });

  it('refuses a session whose token_version was revoked and reads nothing', async () => {
    mockRequireActionAuth.mockRejectedValue(new AuthorizationError('Session expired'));

    const result = await fetchDashboardActivity();

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('refuses a must_change_password session and reads nothing', async () => {
    mockRequireActionAuth.mockRejectedValue(new PasswordChangeRequiredError());

    const result = await fetchDashboardActivity();

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
