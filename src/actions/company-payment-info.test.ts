/**
 * @jest-environment node
 */
import { getCompanyPaymentInfo } from '@/actions/company-payment-info';
import { db } from '@/lib/db';
import { requireTicketRead } from '@/lib/tickets-rbac-server';
import { AuthorizationError } from '@/lib/errors';

jest.mock('@/lib/db', () => ({
  db: { query: { company: { findFirst: jest.fn() } } },
}));
jest.mock('@/lib/tickets-rbac-server', () => ({ requireTicketRead: jest.fn() }));

const mockRequireTicketRead = requireTicketRead as jest.MockedFunction<typeof requireTicketRead>;
const mockFindFirst = db.query.company.findFirst as jest.Mock;

describe('getCompanyPaymentInfo (ZIG-I20-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the caller company resolved by the ticket-read scope, never the requested id', async () => {
    mockRequireTicketRead.mockResolvedValue({
      context: { userId: '1', companyId: 7, companyIsSystem: false },
      companyId: 7,
    });
    mockFindFirst.mockResolvedValue({
      settings: { payment_bank: 'BBVA', payment_clabe: '002010077777777771' },
    });

    const result = await getCompanyPaymentInfo(99);

    expect(mockRequireTicketRead).toHaveBeenCalledWith(99);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      data: { bank: 'BBVA', holder: null, clabe: '002010077777777771', note: null },
    });
  });

  it('returns null data when the company set nothing', async () => {
    mockRequireTicketRead.mockResolvedValue({
      context: { userId: '1', companyId: 7, companyIsSystem: false },
      companyId: 7,
    });
    mockFindFirst.mockResolvedValue({ settings: { tagline: 'x' } });

    await expect(getCompanyPaymentInfo()).resolves.toEqual({ success: true, data: null });
  });

  it('denies a tenant asking for another company (IDOR)', async () => {
    mockRequireTicketRead.mockRejectedValue(new AuthorizationError('Access denied to this company'));

    const result = await getCompanyPaymentInfo(99);

    expect(result.success).toBe(false);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
