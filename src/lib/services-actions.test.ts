import {
  bulkImportServices,
  commitServiceCsvImportChunk,
  createService,
  deleteService,
  getService,
  getServices,
  previewServiceCsvImport,
  searchMaterials,
  updateService,
} from '@/actions/services';
import { material, service, serviceMaterial } from '@/db/schema';
import { db } from '@/lib/db';
import {
  requireActionAuth,
  requireActionPermission,
  requireTenantActionPermission,
} from '@/lib/security';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
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
    transaction: jest.fn(),
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
  transaction: jest.Mock;
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

  it('bulkImportServices denies when permission check fails cross-tenant', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await bulkImportServices([
      { name: 'S', description: 'D', price: '1' },
    ]);

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('createService rejects description longer than 240 characters', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);

    const result = await createService({
      ...servicePayload,
      description: 'x'.repeat(241),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('updateService rejects description longer than 240 characters', async () => {
    mockActionAuthorized(mockRequireTenantActionPermission);

    const result = await updateService({
      id: IDOR_RESOURCES_A.serviceId,
      description: 'y'.repeat(241),
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

describe('service default materials (ZIG-I10)', () => {
  type Write = { kind: 'insert' | 'update'; table: unknown; values: unknown };

  /**
   * db.transaction runs the callback on a tx whose selects answer from a queue
   * (catalog lookup by id, then name lookups) and whose writes are recorded.
   */
  const runTransactionWith = (
    selectResults: unknown[][],
    options: { serviceUpdateMatches?: boolean } = {},
  ) => {
    const writes: Write[] = [];
    let nextMaterialId = 60;
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            const rows = selectResults.shift() ?? [];
            return Object.assign(Promise.resolve(rows), {
              limit: jest.fn(async () => rows),
            });
          }),
        })),
      })),
      insert: jest.fn((table: unknown) => ({
        values: jest.fn((values: unknown) => {
          writes.push({ kind: 'insert', table, values });
          return {
            returning: jest.fn(async () => {
              if (table === service) return [{ id: 77, ...(values as object) }];
              if (table === material) {
                nextMaterialId += 1;
                return [{ id: nextMaterialId, ...(values as object) }];
              }
              return (values as Array<Record<string, unknown>>).map((row, index) => ({
                id: 500 + index,
                ...row,
              }));
            }),
          };
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: jest.fn((values: unknown) => {
          writes.push({ kind: 'update', table, values });
          const where = jest.fn(() =>
            Object.assign(Promise.resolve(), {
              returning: jest.fn(async () =>
                table === service && options.serviceUpdateMatches !== false
                  ? [{ id: IDOR_RESOURCES_A.serviceId, company_id: IDOR_COMPANY_A.id }]
                  : [],
              ),
            }),
          );
          return { where };
        }),
      })),
    };
    mockDb.transaction.mockImplementation(async (callback) => callback(tx));
    return writes;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockActionAuthorized(mockRequireTenantActionPermission);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('createService saves the service and its materials in one transaction', async () => {
    const writes = runTransactionWith([
      // loadCatalogMaterials([9])
      [{ id: 9, name: 'Gas R410A', unit: 'kg', price: 380 }],
      // findOrCreateMaterial('Tubo de cobre') → none yet
      [],
    ]);

    const result = await createService({
      name: 'Instalación minisplit',
      description: 'Incluye base',
      price: 3500,
      company_id: IDOR_COMPANY_A.id,
      materials: [
        { material_id: 9, name: 'Gas R410A', quantity: 1.5, price: 380 },
        { name: 'Tubo de cobre', unit: 'm', quantity: 3, price: 85 },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).not.toHaveBeenCalled();
    const inserts = writes.filter((write) => write.kind === 'insert');
    expect(inserts.map((write) => write.table)).toEqual([
      service,
      material,
      serviceMaterial,
    ]);
    // The authorized caller is tenant B: the new Material lands in its company.
    expect(inserts[1].values).toEqual({
      company_id: IDOR_COMPANY_B.id,
      name: 'Tubo de cobre',
      unit: 'm',
      price: 85,
    });
    expect(inserts[2].values).toEqual([
      { service_id: 77, material_id: 9, quantity: 1.5, price: null, sort_order: 0 },
      { service_id: 77, material_id: 61, quantity: 3, price: null, sort_order: 1 },
    ]);
  });

  it('stores a price override only when it differs from the catalog price', async () => {
    const writes = runTransactionWith([
      [{ id: 9, name: 'Gas R410A', unit: 'kg', price: 380 }],
    ]);

    await createService({
      name: 'Carga de gas',
      description: 'Carga',
      price: 900,
      company_id: IDOR_COMPANY_A.id,
      materials: [{ material_id: 9, name: 'Gas R410A', quantity: 1, price: 420 }],
    });

    const links = writes.find((write) => write.table === serviceMaterial && write.kind === 'insert');
    expect(links?.values).toEqual([
      { service_id: 77, material_id: 9, quantity: 1, price: 420, sort_order: 0 },
    ]);
  });

  it('createService rejects a catalog material of another company (IDOR)', async () => {
    const writes = runTransactionWith([[]]);

    const result = await createService({
      name: 'Instalación',
      description: 'Desc',
      price: 100,
      company_id: IDOR_COMPANY_A.id,
      materials: [{ material_id: 999, name: 'Ajeno', quantity: 1, price: 1 }],
    });

    expect(result.success).toBe(false);
    expect(writes.some((write) => write.table === serviceMaterial)).toBe(false);
  });

  it("updateService never touches another company's service materials (IDOR)", async () => {
    mockDb.query.service.findFirst.mockResolvedValue(undefined);
    const writes = runTransactionWith([], { serviceUpdateMatches: false });

    const result = await updateService({
      id: IDOR_RESOURCES_A.serviceId,
      company_id: IDOR_COMPANY_A.id,
      materials: [{ name: 'Tubo', quantity: 1, price: 10 }],
    });

    expect(result.success).toBe(true);
    expect(writes.some((write) => write.table === serviceMaterial)).toBe(false);
    expect(writes.some((write) => write.table === material)).toBe(false);
  });

  it('updateService replaces the material set of its own service', async () => {
    mockDb.query.service.findFirst.mockResolvedValue({ id: IDOR_RESOURCES_A.serviceId });
    const writes = runTransactionWith([[]]);

    const result = await updateService({
      id: IDOR_RESOURCES_A.serviceId,
      company_id: IDOR_COMPANY_A.id,
      materials: [{ name: 'Tubo', quantity: 2, price: 10 }],
    });

    expect(result.success).toBe(true);
    expect(
      writes.filter((write) => write.table === serviceMaterial).map((write) => write.kind),
    ).toEqual(['update', 'insert']);
  });

  it('rejects invalid materials as a validation error before writing', async () => {
    const result = await createService({
      name: 'S',
      description: 'D',
      price: 1,
      company_id: IDOR_COMPANY_A.id,
      materials: [{ name: ' ', quantity: 0, price: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('searchMaterials denies cross-tenant company context', async () => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission);

    const result = await searchMaterials('gas', IDOR_COMPANY_A.id);

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('searchMaterials returns the company catalog with numeric prices', async () => {
    const limit = jest.fn(async () => [
      { id: 9, name: 'Gas R410A', unit: 'kg', price: '380.00' },
    ]);
    mockDb.select.mockReturnValue({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ orderBy: jest.fn(() => ({ limit })) })),
      })),
    });

    const result = await searchMaterials('gas');

    expect(result).toEqual({
      success: true,
      data: [{ id: 9, name: 'Gas R410A', unit: 'kg', price: 380 }],
    });
  });
});

