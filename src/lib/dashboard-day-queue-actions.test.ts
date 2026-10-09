import { getDashboardDayQueue } from '@/actions/dashboard-day-queue';
import { AuthorizationError } from '@/lib/errors';
import { loadDashboardDayQueueForCompany } from '@/lib/dashboard-day-queue-loader';
import { requireTicketRead } from '@/lib/tickets-rbac-server';
import { IDOR_COMPANY_A, IDOR_COMPANY_B } from '@/test/idor-fixtures';

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
}));

jest.mock('@/lib/dashboard-day-queue-loader', () => ({
  loadDashboardDayQueueForCompany: jest.fn(),
}));

const mockRequireTicketRead = requireTicketRead as jest.MockedFunction<
  typeof requireTicketRead
>;
const mockLoad = loadDashboardDayQueueForCompany as jest.MockedFunction<
  typeof loadDashboardDayQueueForCompany
>;

const emptyQueue = {
  counts: { hoy: 0, atrasados: 0, porCobrar: 0, recordatorios: 0 },
  porCobrarBalance: 0,
  hoy: [],
  atrasados: [],
  porCobrar: [],
  recordatorios: [],
};

describe('getDashboardDayQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the company that requireTicketRead resolves', async () => {
    mockRequireTicketRead.mockResolvedValue({
      companyId: IDOR_COMPANY_B.id,
    } as Awaited<ReturnType<typeof requireTicketRead>>);
    mockLoad.mockResolvedValue(emptyQueue);

    const result = await getDashboardDayQueue();

    expect(result.success).toBe(true);
    expect(mockRequireTicketRead).toHaveBeenCalledWith(undefined);
    expect(mockLoad).toHaveBeenCalledWith(IDOR_COMPANY_B.id);
  });
});

describe('cross-tenant IDOR — dashboard day queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTicketRead.mockRejectedValue(
      new AuthorizationError('Access denied to requested company'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('denies a requested company the caller cannot read and loads nothing', async () => {
    const result = await getDashboardDayQueue(IDOR_COMPANY_A.id);

    expect(result.success).toBe(false);
    expect(mockRequireTicketRead).toHaveBeenCalledWith(IDOR_COMPANY_A.id);
    expect(mockLoad).not.toHaveBeenCalled();
  });
});
