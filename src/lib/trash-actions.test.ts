import {
  getTrash,
  restoreClient,
  restoreService,
  restoreTicket,
} from '@/actions/trash';
import { db } from '@/lib/db';
import {
  checkPermission,
  requireActionAuth,
  requireActionPermission,
} from '@/lib/security';
import {
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  tenantBContext,
} from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    query: {
      client: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      ticket: { findFirst: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/ticket-audit', () => ({ recordTicketAudit: jest.fn() }));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  update: jest.Mock;
  query: {
    client: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
    ticket: { findFirst: jest.Mock };
  };
};

describe('cross-tenant IDOR - trash actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('getTrash returns empty payload when auth context has no company', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: null,
      companyIsSystem: false,
    });

    const result = await getTrash();

    expect(result).toEqual({
      success: true,
      data: { clients: [], services: [], tickets: [] },
    });
    expect(mockCheckPermission).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it.each([
    ['restoreClient', () => restoreClient(IDOR_RESOURCES_A.clientId), 'CL006'],
    ['restoreService', () => restoreService(IDOR_RESOURCES_A.serviceId), 'SV001'],
    ['restoreTicket', () => restoreTicket(IDOR_RESOURCES_A.ticketId), 'TC008'],
  ])(
    '%s does not restore foreign tenant resources',
    async (_name, call, expectedCode) => {
      mockRequireActionPermission.mockResolvedValue({
        context: tenantBContext(),
        companyId: IDOR_COMPANY_B.id,
      });
      mockDb.query.client.findFirst.mockResolvedValue(undefined);
      mockDb.query.service.findFirst.mockResolvedValue(undefined);
      mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

      const result = await call();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(expectedCode);
      expect(mockDb.update).not.toHaveBeenCalled();
    },
  );
});
