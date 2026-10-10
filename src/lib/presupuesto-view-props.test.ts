import {
  buildPresupuestoEditState,
  buildPresupuestoViewProps,
} from '@/lib/presupuesto-view-props';

jest.mock('@/actions/presupuestos', () => ({}));

const row = {
  id: 1057n,
  client_id: 5,
  client_name: 'Plaza Comercial Aurora',
  client_tel: '9981000001',
  ticket_date: new Date('2026-10-09T12:00:00.000Z'),
  expires_at: new Date('2026-11-08T00:00:00.000Z'),
  work_notes: 'Incluye material',
  total: 4800,
  document_kind: 'presupuesto',
  canceled_at: null,
  converted_to_ticket_id: null,
  services_tickets: [
    {
      id: 90,
      service_id: null,
      name: 'Revisión de fuga',
      description: 'Con nitrógeno',
      quantity: 1,
      price: 600,
      service: null,
    },
    {
      id: 91,
      service_id: 7,
      name: null,
      description: null,
      quantity: 2,
      price: 2100,
      service: { name: 'Mantenimiento', description: 'Preventivo' },
    },
  ],
} as never;

describe('presupuesto view props (ZIG-I5-4 / ZIG-I5-5)', () => {
  it('maps the row for the review and detail pages', () => {
    const props = buildPresupuestoViewProps(row);
    expect(props).toMatchObject({
      presupuestoId: '1057',
      clientName: 'Plaza Comercial Aurora',
      total: 4800,
      status: 'abierto',
      downloadFileName: 'presupuesto_Plaza Comercial Aurora_2026-10-09_1057.pdf',
    });
    expect(props.lines).toEqual([
      { id: 90, serviceId: null, name: 'Revisión de fuga', quantity: 1, price: 600 },
      { id: 91, serviceId: 7, name: 'Mantenimiento', quantity: 2, price: 2100 },
    ]);
  });

  it('maps the row into composer edit state, keeping inline lines inline', () => {
    const state = buildPresupuestoEditState(row);
    expect(state.client).toEqual({
      id: 5,
      label: 'Plaza Comercial Aurora · 9981000001',
    });
    expect(state.notes).toBe('Incluye material');
    expect(state.expiresAt).toBe('2026-11-08T00:00:00.000Z');
    expect(state.lines).toEqual([
      {
        key: 'line-90',
        kind: 'custom',
        service_id: null,
        service_name: 'Revisión de fuga',
        description: 'Con nitrógeno',
        save_to_catalog: false,
        quantity: 1,
        price: 600,
      },
      {
        key: 'line-91',
        kind: 'catalog',
        service_id: 7,
        service_name: 'Mantenimiento',
        quantity: 2,
        price: 2100,
      },
    ]);
  });

  it('loads saved materials into the edit state as drafts (ZIG-I10)', () => {
    const withMaterials = {
      ...(row as unknown as Record<string, unknown>),
      services_tickets: [
        {
          id: 92,
          service_id: 7,
          name: null,
          description: null,
          quantity: 1,
          price: 2100,
          service: { name: 'Mantenimiento', description: 'Preventivo' },
          materials: [
            { material_id: 21, name: 'Gas R410A', unit: 'kg', quantity: '1.50', price: '380.00' },
            { material_id: null, name: 'Cinta', unit: null, quantity: 1, price: 40 },
          ],
        },
      ],
    } as never;
    const [editLine] = buildPresupuestoEditState(withMaterials).lines;
    expect(editLine.materials).toEqual([
      expect.objectContaining({ material_id: 21, name: 'Gas R410A', quantity: 1.5, price: 380 }),
      expect.objectContaining({ material_id: null, name: 'Cinta', quantity: 1, price: 40 }),
    ]);
  });
});

