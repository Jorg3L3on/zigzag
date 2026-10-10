import {
  composerServiceLineSchema,
  isCustomServiceLine,
  serviceLineInputFromRow,
  serviceLineInputSchema,
} from '@/lib/ticket-service-line-schema';

describe('serviceLineInputSchema (ZIG-I5)', () => {
  it('parses legacy catalog payloads without kind', () => {
    const parsed = serviceLineInputSchema.parse({
      service_id: 7,
      quantity: 2,
      price: 100,
    });
    expect(isCustomServiceLine(parsed)).toBe(false);
    expect(parsed).toEqual({ service_id: 7, quantity: 2, price: 100, materials: [] });
  });

  it('parses an inline line, trims it and defaults save_to_catalog to false', () => {
    const parsed = serviceLineInputSchema.parse({
      kind: 'custom',
      name: '  Cambio de capacitor 35 µF  ',
      description: '   ',
      quantity: 1,
      price: 850,
    });
    expect(isCustomServiceLine(parsed)).toBe(true);
    expect(parsed).toEqual({
      kind: 'custom',
      name: 'Cambio de capacitor 35 µF',
      description: undefined,
      save_to_catalog: false,
      quantity: 1,
      price: 850,
      materials: [],
    });
  });

  it.each([
    ['empty name', { kind: 'custom', name: '   ', quantity: 1, price: 1 }],
    ['name over 100', { kind: 'custom', name: 'x'.repeat(101), quantity: 1, price: 1 }],
    [
      'description over 240',
      { kind: 'custom', name: 'A', description: 'x'.repeat(241), quantity: 1, price: 1 },
    ],
    ['custom with zero quantity', { kind: 'custom', name: 'A', quantity: 0, price: 1 }],
    ['catalog without service_id', { quantity: 1, price: 1 }],
    ['negative price', { service_id: 1, quantity: 1, price: -1 }],
  ])('rejects %s', (_label, payload) => {
    expect(serviceLineInputSchema.safeParse(payload).success).toBe(false);
  });

  it('composer schema bounds quantity (0.01–9,999.99, two decimals) and price on both kinds', () => {
    expect(
      composerServiceLineSchema.safeParse({ service_id: 1, quantity: 1.5, price: 1 })
        .success,
    ).toBe(true);
    expect(
      composerServiceLineSchema.safeParse({ service_id: 1, quantity: 1.234, price: 1 })
        .success,
    ).toBe(false);
    expect(
      composerServiceLineSchema.safeParse({ service_id: 1, quantity: 0.005, price: 1 })
        .success,
    ).toBe(false);
    expect(
      composerServiceLineSchema.safeParse({
        kind: 'custom',
        name: 'A',
        quantity: 10000,
        price: 1,
      }).success,
    ).toBe(false);
    expect(
      composerServiceLineSchema.safeParse({
        kind: 'custom',
        name: 'A',
        quantity: 3,
        price: 4200,
      }).success,
    ).toBe(true);
  });

  it('serviceLineInputFromRow keeps inline rows inline and catalog rows catalog', () => {
    expect(
      serviceLineInputFromRow({
        service_id: null,
        name: 'Visita',
        description: null,
        quantity: 1,
        price: '350.50' as unknown as number,
      }),
    ).toEqual({
      kind: 'custom',
      name: 'Visita',
      description: undefined,
      save_to_catalog: false,
      quantity: 1,
      price: 350.5,
    });
    expect(
      serviceLineInputFromRow({ service_id: 4, name: null, quantity: 2, price: 10 }),
    ).toEqual({ service_id: 4, quantity: 2, price: 10 });
  });
});

describe('line materials (ZIG-I10)', () => {
  it('parses catalog and inline materials under a line', () => {
    const parsed = serviceLineInputSchema.parse({
      service_id: 7,
      quantity: 1,
      price: 4200,
      materials: [
        { material_id: 3, quantity: 2, price: 450 },
        { kind: 'custom', name: '  Tubo 1/4  ', unit: ' m ', quantity: 2.5, price: 85 },
      ],
    });
    expect(parsed.materials).toEqual([
      { material_id: 3, quantity: 2, price: 450 },
      {
        kind: 'custom',
        name: 'Tubo 1/4',
        unit: 'm',
        quantity: 2.5,
        price: 85,
        save_to_catalog: false,
      },
    ]);
  });

  it.each([
    ['zero quantity', { material_id: 1, quantity: 0, price: 1 }],
    ['negative price', { material_id: 1, quantity: 1, price: -1 }],
    ['inline without name', { kind: 'custom', name: ' ', quantity: 1, price: 1 }],
    ['unit over 20', { kind: 'custom', name: 'A', unit: 'x'.repeat(21), quantity: 1, price: 1 }],
  ])('rejects a material with %s', (_label, material) => {
    expect(
      serviceLineInputSchema.safeParse({
        service_id: 1,
        quantity: 1,
        price: 1,
        materials: [material],
      }).success,
    ).toBe(false);
  });

  it('caps a line at 30 materials', () => {
    const materials = Array.from({ length: 31 }, () => ({
      material_id: 1,
      quantity: 1,
      price: 1,
    }));
    expect(
      serviceLineInputSchema.safeParse({ service_id: 1, quantity: 1, price: 1, materials })
        .success,
    ).toBe(false);
  });

  it('serviceLineInputFromRow maps stored materials back to inputs', () => {
    expect(
      serviceLineInputFromRow({
        service_id: 4,
        quantity: 1,
        price: 10,
        materials: [
          { material_id: 9, name: 'Gas R410A', unit: 'kg', quantity: '1.50', price: '380.00' },
          { material_id: null, name: 'Cinta', unit: null, quantity: 1, price: 40 },
        ],
      }),
    ).toEqual({
      service_id: 4,
      quantity: 1,
      price: 10,
      materials: [
        { kind: 'catalog', material_id: 9, quantity: 1.5, price: 380 },
        {
          kind: 'custom',
          name: 'Cinta',
          unit: null,
          save_to_catalog: false,
          quantity: 1,
          price: 40,
        },
      ],
    });
  });
});
