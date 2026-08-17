import {
  bulkImportServices,
  commitServiceCsvImportChunk,
  createService,
  deleteService,
  getService,
  getServices,
  getServicesForExport,
  previewServiceCsvImport,
  updateService,
} from '@/actions/services';
import { db } from '@/lib/db';
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
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireTenantActionPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/client-service-schedule-lifecycle', () => ({
  pauseSchedulesForService: jest.fn(),
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
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('getService denies cross-tenant company context', async () => {
    mockRequireActionAuth.mockResolvedValue({
      userId: '201',
      companyId: IDOR_COMPANY_A.id,
      companyIsSystem: false,
    });
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await getService(IDOR_RESOURCES_A.serviceId);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('deleteService does not mutate foreign service in tenant scope', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);
    mockDb.query.service.findFirst.mockResolvedValue(undefined);
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const result = await deleteService(IDOR_RESOURCES_A.serviceId);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('getServicesForExport uses authorized tenant scope only', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const result = await getServicesForExport();

    expect(result.success).toBe(true);
  });

  it('bulkImportServices denies when permission check fails cross-tenant', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await bulkImportServices([
      { name: 'S', description: 'D', price: '1' },
    ]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('createService rejects description longer than 120 characters', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);

    const result = await createService({
      ...servicePayload,
      description: 'x'.repeat(121),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('updateService rejects description longer than 120 characters', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);

    const result = await updateService({
      id: IDOR_RESOURCES_A.serviceId,
      description: 'y'.repeat(121),
      company_id: IDOR_COMPANY_A.id,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('previewServiceCsvImport denies cross-tenant write context', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await previewServiceCsvImport([
      { nombre: 'S', descripción: 'D', precio: '1' },
    ]);

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('previewServiceCsvImport classifies without inserting', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([{ name: 'Existente' }]));

    const result = await previewServiceCsvImport([
      { nombre: 'Nuevo', descripción: 'Desc', precio: '10' },
      { nombre: 'Existente', descripción: 'Dup', precio: '5' },
    ]);

    expect(result.success).toBe(true);
    expect(result.data?.summary).toEqual({ ok: 1, skipped: 1, failed: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('commitServiceCsvImportChunk denies cross-tenant write context', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await commitServiceCsvImportChunk([
      { name: 'S', description: 'D', price: 1 },
    ]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('commitServiceCsvImportChunk skips active duplicates and inserts others', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);
    mockDb.select.mockReturnValue(mockSelectChain([{ name: 'Existente' }]));
    const returning = jest.fn(async () => [
      {
        id: 9,
        name: 'Nuevo',
        description: 'Desc',
        price: 10,
        company_id: IDOR_COMPANY_A.id,
      },
    ]);
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({ returning })),
    });

    const result = await commitServiceCsvImportChunk([
      { name: 'Existente', description: 'Dup', price: 5 },
      { name: 'Nuevo', description: 'Desc', price: 10 },
    ]);

    expect(result.success).toBe(true);
    expect(result.data?.inserted).toBe(1);
    expect(result.data?.skipped).toBe(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
