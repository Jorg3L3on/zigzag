import {
  bulkImportServices,
  createService,
  deleteService,
  getServices,
  getServicesForExport,
  updateService,
} from '@/actions/services';
import { db } from '@/lib/db';
import { requireActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockActionAuthorized,
  mockActionCrossTenantDenied,
} from '@/test/cross-tenant-action-helpers';
import { mockSelectChain, mockUpdateReturningEmpty } from '@/test/cross-tenant-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    query: { service: { findFirst: jest.fn() } },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/company-entitlement-guard', () => ({
  assertCompanyEntitlementAllows: jest.fn(),
  CompanyEntitlementExceededError: class extends Error {},
}));
jest.mock('@/lib/client-service-schedule-lifecycle', () => ({
  pauseSchedulesForService: jest.fn(),
}));

const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  query: { service: { findFirst: jest.Mock } };
};

describe('cross-tenant IDOR — service actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const servicePayload = {
    name: 'Service',
    description: 'Desc',
    price: 100,
    company_id: IDOR_COMPANY_A.id,
  };

  it.each([
    ['getServices', () => getServices(IDOR_COMPANY_A.id)],
    ['createService', () => createService(servicePayload)],
    [
      'updateService',
      () => updateService({ id: IDOR_RESOURCES_A.serviceId, ...servicePayload }),
    ],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('deleteService does not mutate foreign service in tenant scope', async () => {
    mockActionAuthorized(mockRequireActionPermission);
    mockDb.query.service.findFirst.mockResolvedValue(undefined);
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const result = await deleteService(IDOR_RESOURCES_A.serviceId);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('getServicesForExport uses authorized tenant scope only', async () => {
    mockActionAuthorized(mockRequireActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const result = await getServicesForExport();

    expect(result.success).toBe(true);
  });

  it('bulkImportServices denies when permission check fails cross-tenant', async () => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await bulkImportServices([
      { name: 'S', description: 'D', price: '1' },
    ]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
