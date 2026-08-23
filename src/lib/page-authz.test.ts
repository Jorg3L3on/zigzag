import { redirect } from 'next/navigation';
import { AuthorizationError } from '@/lib/errors';
import { requirePagePermission } from '@/lib/page-authz';
import { checkPermission, requireActionAuth } from '@/lib/security';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  checkPermission: jest.fn(),
  requireSystemUser: jest.fn(),
}));

const mockRedirect = redirect as unknown as jest.Mock;
const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;

describe('requirePagePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to login when auth fails on client navigations', async () => {
    mockRequireActionAuth.mockRejectedValueOnce(
      new AuthorizationError('Session expired'),
    );

    await expect(requirePagePermission('tickets.read')).rejects.toThrow(
      'NEXT_REDIRECT:/login?reason=expired',
    );
    expect(mockRedirect).toHaveBeenCalledWith('/login?reason=expired');
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });

  it('redirects to forbidden when company context is invalid', async () => {
    mockRequireActionAuth.mockResolvedValueOnce({
      userId: '1',
      companyId: null,
      companyIsSystem: true,
    });

    await expect(requirePagePermission('tickets.read')).rejects.toThrow(
      'NEXT_REDIRECT:/forbidden',
    );
    expect(mockRedirect).toHaveBeenCalledWith('/forbidden');
  });

  it('returns company id when permission is granted', async () => {
    mockRequireActionAuth.mockResolvedValueOnce({
      userId: '7',
      companyId: 42,
      companyIsSystem: false,
    });
    mockCheckPermission.mockResolvedValueOnce(true);

    await expect(requirePagePermission('tickets.read')).resolves.toBe(42);
    expect(mockCheckPermission).toHaveBeenCalledWith('7', 42, 'tickets.read');
  });
});
