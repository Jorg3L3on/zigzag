import { material, service, servicesTickets, ticketLineMaterial } from '@/db/schema';
import {
  assertCatalogServicesBelongToCompany,
  catalogServiceIds,
  copyLineMaterialValues,
  copyServiceLineValues,
  findOrCreateMaterial,
  insertServiceLines,
  loadCatalogMaterials,
  parseServiceLines,
} from '@/lib/service-lines-server';
import { AuthorizationError } from '@/lib/errors';

jest.mock('@/lib/db', () => ({ db: {} }));

type InsertCall = { table: unknown; values: unknown };

const makeTx = (options: { failLineInsert?: boolean } = {}) => {
  const calls: InsertCall[] = [];
  let nextServiceId = 500;
  const tx = {
    insert: jest.fn((table: unknown) => ({
      values: jest.fn((values: unknown) => {
        calls.push({ table, values });
        return {
          returning: jest.fn(async () => {
            if (table === service) {
              nextServiceId += 1;
              return [{ id: nextServiceId }];
            }
            if (options.failLineInsert) {
              throw new Error('line insert failed');
            }
            return (values as Array<Record<string, unknown>>).map((row, index) => ({
              id: 900 + index,
              ...row,
            }));
          }),
        };
      }),
    })),
  };
  return { tx, calls };
};

describe('service-lines-server (ZIG-I5)', () => {
  const lines = parseServiceLines([
    { service_id: 7, quantity: 3, price: 4200 },
    { kind: 'custom', name: 'Cambio de capacitor', quantity: 1, price: 850.005 },
    {
      kind: 'custom',
      name: 'Instalación minisplit 2 ton',
      description: 'Incluye base',
      save_to_catalog: true,
      quantity: 1,
      price: 3500,
    },
  ]);

  it('catalogServiceIds only returns catalog ids, deduplicated', () => {
    expect(
      catalogServiceIds(
        parseServiceLines([
          { service_id: 7, quantity: 1, price: 1 },
          { service_id: 7, quantity: 2, price: 1 },
          { kind: 'custom', name: 'A', quantity: 1, price: 1 },
        ]),
      ),
    ).toEqual([7]);
  });

  it('inserts catalog, inline and saved-to-catalog lines in the same transaction', async () => {
    const { tx, calls } = makeTx();
    const { rows, createdServiceIds } = await insertServiceLines(tx as never, {
      companyId: 10,
      ticketId: 42n,
      lines,
    });

    // The catalog Service is created on the tx, before the lines.
    expect(calls[0].table).toBe(service);
    expect(calls[0].values).toEqual({
      company_id: 10,
      name: 'Instalación minisplit 2 ton',
      description: 'Incluye base',
      price: 3500,
    });
    expect(calls[1].table).toBe(servicesTickets);
    expect(calls[1].values).toEqual([
      { ticket_id: 42n, service_id: 7, quantity: 3, price: 4200 },
      {
        ticket_id: 42n,
        service_id: null,
        name: 'Cambio de capacitor',
        description: null,
        quantity: 1,
        price: 850.01,
      },
      { ticket_id: 42n, service_id: 501, quantity: 1, price: 3500 },
    ]);
    expect(createdServiceIds).toEqual([501]);
    expect(rows).toHaveLength(3);
  });

  it('a saved-to-catalog Service without description uses its name', async () => {
    const { tx, calls } = makeTx();
    await insertServiceLines(tx as never, {
      companyId: 10,
      ticketId: 1n,
      lines: parseServiceLines([
        { kind: 'custom', name: 'Visita', save_to_catalog: true, quantity: 1, price: 300 },
      ]),
    });
    expect(calls[0].values).toEqual(
      expect.objectContaining({ name: 'Visita', description: 'Visita' }),
    );
  });

  it('propagates a failure after the Service insert so the transaction rolls both back', async () => {
    const { tx, calls } = makeTx({ failLineInsert: true });
    await expect(
      insertServiceLines(tx as never, { companyId: 10, ticketId: 42n, lines }),
    ).rejects.toThrow('line insert failed');
    // Both writes went through the same tx (no separate db call), so the
    // caller's db.transaction aborts the Service insert too.
    expect(calls.map((call) => call.table)).toEqual([service, servicesTickets]);
  });

  it('assertCatalogServicesBelongToCompany rejects ids from another company', async () => {
    const executor = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(async () => [{ id: 7 }]) })),
      })),
    };
    await expect(
      assertCatalogServicesBelongToCompany(executor as never, [7, 8], 10),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      assertCatalogServicesBelongToCompany(executor as never, [7], 10),
    ).resolves.toBeUndefined();
    executor.select.mockClear();
    await assertCatalogServicesBelongToCompany(executor as never, [], 10);
    expect(executor.select).not.toHaveBeenCalled();
  });

  it('copyServiceLineValues keeps inline name/description and catalog ids verbatim', () => {
    expect(
      copyServiceLineValues(
        [
          { service_id: 7, name: null, description: null, quantity: 2, price: 10 },
          { service_id: null, name: 'Capacitor', description: '35 µF', quantity: 1, price: 850 },
        ],
        99n,
      ),
    ).toEqual([
      { ticket_id: 99n, service_id: 7, name: null, description: null, quantity: 2, price: 10 },
      {
        ticket_id: 99n,
        service_id: null,
        name: 'Capacitor',
        description: '35 µF',
        quantity: 1,
        price: 850,
      },
    ]);
  });
});

describe('line materials in service-lines-server (ZIG-I10)', () => {
  /** A tx whose selects answer from a queue (catalog lookup, then name lookups). */
  const makeMaterialTx = (selectResults: unknown[][]) => {
    const inserts: InsertCall[] = [];
    let nextLineId = 700;
    let nextMaterialId = 40;
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
          inserts.push({ table, values });
          return {
            returning: jest.fn(async () => {
              if (table === servicesTickets) {
                nextLineId += 1;
                return [{ id: nextLineId, ...(values as object) }];
              }
              if (table === material) {
                nextMaterialId += 1;
                return [{ id: nextMaterialId, ...(values as object) }];
              }
              return (values as Array<Record<string, unknown>>).map((row, index) => ({
                id: 900 + index,
                ...row,
              }));
            }),
          };
        }),
      })),
    };
    return { tx, inserts };
  };

  it('inserts each line, then its materials with catalog snapshots and saved-to-catalog links', async () => {
    const { tx, inserts } = makeMaterialTx([
      // loadCatalogMaterials([3])
      [{ id: 3, name: 'Gas R410A', unit: 'kg', price: 380 }],
      // findOrCreateMaterial('Tubo de cobre 1/4') → not found, created
      [],
    ]);
    const { rows, createdMaterialIds } = await insertServiceLines(tx as never, {
      companyId: 10,
      ticketId: 42n,
      lines: parseServiceLines([
        {
          service_id: 7,
          quantity: 1,
          price: 1200,
          materials: [
            { material_id: 3, quantity: 1.5, price: 400 },
            {
              kind: 'custom',
              name: 'Tubo de cobre 1/4',
              unit: 'm',
              quantity: 3,
              price: 85,
              save_to_catalog: true,
            },
            { kind: 'custom', name: 'Cinta', quantity: 1, price: 40.005 },
          ],
        },
        { kind: 'custom', name: 'Visita', quantity: 1, price: 300 },
      ]),
    });

    expect(inserts.map((call) => call.table)).toEqual([
      servicesTickets,
      material,
      ticketLineMaterial,
      servicesTickets,
    ]);
    expect(inserts[1].values).toEqual({
      company_id: 10,
      name: 'Tubo de cobre 1/4',
      unit: 'm',
      price: 85,
    });
    expect(inserts[2].values).toEqual([
      {
        services_tickets_id: 701,
        material_id: 3,
        name: 'Gas R410A',
        unit: 'kg',
        quantity: 1.5,
        price: 400,
        sort_order: 0,
      },
      {
        services_tickets_id: 701,
        material_id: 41,
        name: 'Tubo de cobre 1/4',
        unit: 'm',
        quantity: 3,
        price: 85,
        sort_order: 1,
      },
      {
        services_tickets_id: 701,
        material_id: null,
        name: 'Cinta',
        unit: null,
        quantity: 1,
        price: 40.01,
        sort_order: 2,
      },
    ]);
    expect(createdMaterialIds).toEqual([41]);
    expect(rows.map((row) => row.materials.length)).toEqual([3, 0]);
  });

  it('rejects a catalog material of another company (IDOR) before inserting materials', async () => {
    const { tx, inserts } = makeMaterialTx([[]]);
    await expect(
      insertServiceLines(tx as never, {
        companyId: 10,
        ticketId: 42n,
        lines: parseServiceLines([
          {
            service_id: 7,
            quantity: 1,
            price: 1,
            materials: [{ material_id: 999, quantity: 1, price: 1 }],
          },
        ]),
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(inserts.some((call) => call.table === ticketLineMaterial)).toBe(false);
  });

  it('loadCatalogMaterials scopes the lookup to the company and active rows', async () => {
    const { tx } = makeMaterialTx([[{ id: 3, name: 'A', unit: null, price: 1 }]]);
    const map = await loadCatalogMaterials(tx as never, [3, 3], 10);
    expect([...map.keys()]).toEqual([3]);
  });

  it('findOrCreateMaterial reuses an active material with the same name', async () => {
    const existing = { id: 5, name: 'Gas R410A', unit: 'kg', price: 380 };
    const { tx, inserts } = makeMaterialTx([[existing]]);
    const result = await findOrCreateMaterial(tx as never, {
      companyId: 10,
      name: '  gas r410a ',
      unit: null,
      price: 1,
    });
    expect(result).toEqual({ row: existing, created: false });
    expect(inserts).toHaveLength(0);
  });

  it('copyLineMaterialValues moves material rows onto a new line verbatim', () => {
    expect(
      copyLineMaterialValues(
        [{ material_id: null, name: 'Cinta', unit: null, quantity: 1, price: 40, sort_order: 2 }],
        55,
      ),
    ).toEqual([
      {
        services_tickets_id: 55,
        material_id: null,
        name: 'Cinta',
        unit: null,
        quantity: 1,
        price: 40,
        sort_order: 2,
      },
    ]);
  });
});
