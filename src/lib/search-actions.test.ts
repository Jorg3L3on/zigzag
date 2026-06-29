import { globalSearch } from '@/actions/search';
import { db } from '@/lib/db';
import { checkPermission, requireActionAuth } from '@/lib/security';
import { tenantBContext } from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
  requireActionAuth: jest.fn(),
}));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;
const mockDb = db as unknown as { select: jest.Mock };

describe('cross-tenant IDOR - search actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns empty results for authenticated users without company scope', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: null,
      companyIsSystem: false,
    });

    const result = await globalSearch('client');

    expect(result).toEqual({ success: true, data: [] });
    expect(mockCheckPermission).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('does not query foreign resources when tenant has no read permissions', async () => {
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
    mockCheckPermission.mockResolvedValue(false);

    const result = await globalSearch('acme');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(mockCheckPermission).toHaveBeenCalledTimes(3);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
