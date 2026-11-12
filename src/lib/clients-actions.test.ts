import {
  bulkImportClients,
  createClient,
  deleteClient,
  getClient,
  getClients,
  getClientsList,
  updateClient,
} from '@/actions/clients';
import { PgDialect } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { recordResourceAudit } from '@/lib/resource-audit';
import {
  requireActionAuth,
  requireActionPermission,
  requireTenantActionPermission,
} from '@/lib/security';
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
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireTenantActionPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/client-service-schedule-lifecycle', () => ({
  pauseSchedulesForClient: jest.fn(),
}));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockRequireTenantActionPermission =
  requireTenantActionPermission as jest.MockedFunction<
    typeof requireTenantActionPermission
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
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('getClient returns not found for foreign client id in tenant scope', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: IDOR_COMPANY_A.id,
      companyIsSystem: false,
    });
    mockActionAuthorized(mockRequireActionPermission, IDOR_COMPANY_A.id);
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const result = await getClient(IDOR_RESOURCES_A.clientId);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('bulkImportClients denies cross-tenant write context', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await bulkImportClients([{ name: 'X', email: '', phone: '' }]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('client actions — audit fixes (ZIG-I36)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockActionAuthorized(mockRequireTenantActionPermission, IDOR_COMPANY_A.id);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const whereSql = (condition: unknown) =>
    new PgDialect().sqlToQuery(condition as never);

  it('getClientsList filters on the resolved company even when companyId is null (ZIG-I36-10)', async () => {
    const chain = mockSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    await getClientsList({ companyId: null });

    const query = whereSql(chain.where.mock.calls[0][0]);
    expect(query.sql).not.toMatch(/company_id" is null/i);
    expect(query.params).toContain(IDOR_COMPANY_A.id);
  });

  it('getClients filters on the resolved company even when companyId is null (ZIG-I36-10)', async () => {
    const count = { from: jest.fn(() => ({ where: jest.fn(async () => [{ total: 0 }]) })) };
    const rows = mockSelectChain([]);
    const orderBy = jest.fn(() => ({
      limit: jest.fn(() => ({ offset: jest.fn(async () => []) })),
    }));
    const where = jest.fn(() => ({ orderBy }));
    mockDb.select
      .mockReturnValueOnce(count)
      .mockReturnValueOnce({ from: jest.fn(() => ({ where })) });

    await getClients({ companyId: null });

    expect(rows).toBeDefined();
    const query = whereSql((where.mock.calls[0] as unknown[])[0]);
    expect(query.sql).not.toMatch(/company_id" is null/i);
    expect(query.params).toContain(IDOR_COMPANY_A.id);
  });

  const updateChain = (updated: unknown[]) => {
    const returning = jest.fn(async () => updated);
    const where = jest.fn(() => ({ returning }));
    const set = jest.fn(() => ({ where }));
    mockDb.update.mockReturnValue({ set });
    return { set };
  };

  it('updateClient writes only whitelisted columns (ZIG-I36-12)', async () => {
    mockDb.query.client.findFirst.mockResolvedValue({ id: 5, name: 'Antes' });
    const { set } = updateChain([{ id: 5, name: 'Nuevo' }]);

    const result = await updateClient({
      id: 5,
      name: 'Nuevo',
      deleted_at: new Date(),
      company_id: 999,
    } as never);

    expect(result.success).toBe(true);
    expect(set).toHaveBeenCalledWith({ name: 'Nuevo' });
  });

  it('updateClient and deleteClient fail when no row matched (ZIG-I36-13)', async () => {
    mockDb.query.client.findFirst.mockResolvedValue(undefined);
    updateChain([]);

    const updated = await updateClient({ id: IDOR_RESOURCES_A.clientId, name: 'X' });
    const deleted = await deleteClient(IDOR_RESOURCES_A.clientId);

    expect(updated.success).toBe(false);
    expect(updated.errorCode).toBe('CL006');
    expect(deleted.success).toBe(false);
    expect(deleted.errorCode).toBe('CL006');
    expect(recordResourceAudit).not.toHaveBeenCalled();
  });
});
