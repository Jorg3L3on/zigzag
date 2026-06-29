import {
  bulkImportClients,
  createClient,
  deleteClient,
  getClient,
  getClients,
  getClientsForExport,
  getClientsList,
  updateClient,
} from '@/actions/clients';
import { db } from '@/lib/db';
import { requireActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockActionAuthorized,
  mockActionCrossTenantDenied,
} from '@/test/cross-tenant-action-helpers';
import { mockSelectChain } from '@/test/cross-tenant-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    query: { client: { findFirst: jest.fn() } },
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
  pauseSchedulesForClient: jest.fn(),
}));

const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  query: { client: { findFirst: jest.Mock } };
};

describe('cross-tenant IDOR — client actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const clientPayload = {
    name: 'Client',
    phone: '5551234567',
    email: null,
    address: null,
    street: null,
    exterior_number: null,
    interior_number: null,
    neighborhood: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    company_id: IDOR_COMPANY_A.id,
  };

  it.each([
    ['getClients', () => getClients({ companyId: IDOR_COMPANY_A.id })],
    ['getClientsList', () => getClientsList({ companyId: IDOR_COMPANY_A.id })],
    ['createClient', () => createClient(clientPayload)],
    [
      'updateClient',
      () => updateClient({ id: IDOR_RESOURCES_A.clientId, ...clientPayload }),
    ],
    [
      'deleteClient',
      () => deleteClient(IDOR_RESOURCES_A.clientId, IDOR_COMPANY_A.id),
    ],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('getClient returns not found for foreign client id in tenant scope', async () => {
    mockActionAuthorized(mockRequireActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const result = await getClient(IDOR_RESOURCES_A.clientId);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('getClientsForExport uses authorized tenant scope only', async () => {
    mockActionAuthorized(mockRequireActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const result = await getClientsForExport();

    expect(result.success).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('bulkImportClients denies cross-tenant write context', async () => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await bulkImportClients([{ name: 'X', email: '', phone: '' }]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
