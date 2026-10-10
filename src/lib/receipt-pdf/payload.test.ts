import {
  buildReceiptPdfPayload,
  formatReceiptFolio,
  formatReceiptMoney,
  formatReceiptQuantity,
  type ReceiptPdfTicket,
} from '@/lib/receipt-pdf/payload';

type Line = ReceiptPdfTicket['services_tickets'][number];

const catalogLine = (
  id: number,
  name: string,
  description: string,
  price: number,
  quantity = 1,
  overrides: Partial<Line> = {},
): Line => ({
  id,
  service_id: 100 + id,
  name: null,
  description: null,
  ticket_id: 1114n,
  quantity,
  price,
  created_at: new Date(),
  updated_at: null,
  deleted_at: null,
  service: {
    id: 100 + id,
    name,
    description,
    price,
    created_at: new Date(),
    updated_at: null,
    deleted_at: null,
    company_id: 4,
  },
  ...overrides,
});

const baseTicket = (overrides: Partial<ReceiptPdfTicket> = {}) =>
  ({
    id: 1114n,
    client_id: 7,
    client_name: 'Cliente test',
    client_tel: '961 315 1552',
    work_notes: null,
    ticket_date: new Date(2026, 9, 10, 12),
    total: 325,
    paid: 0,
    email: null,
    finished: false,
    document: null,
    document_kind: 'ticket',
    expires_at: null,
    canceled_at: null,
    converted_to_ticket_id: null,
    converted_from_ticket_id: null,
    created_at: new Date(2026, 9, 10, 12),
    updated_at: null,
    deleted_at: null,
    company_id: 4,
    userId: null,
    client: {
      country: 'México',
      phone: '000',
    } as ReceiptPdfTicket['client'],
    company: {
      id: 4,
      name: 'ClimaTotal Demo',
      email: 'contacto@climatotal.demo',
      phone: '+52 55 4123 8900',
      logo: null,
      street: 'Av. Insurgentes Sur',
      exterior_number: '1602',
      interior_number: null,
      neighborhood: 'Crédito Constructor',
      city: 'Ciudad de México',
      state: 'CDMX',
      postal_code: '03940',
      country: 'México',
      settings: {
        default_currency: 'MXN',
        tagline: 'Climatización · Servicio técnico',
      },
      status: 'ACTIVE',
      is_system: false,
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
    },
    services_tickets: [
      catalogLine(1, 'Jorge', 'Hh', 66),
      catalogLine(2, 'Prueba', 'Una descripción del servicio', 259),
    ],
    ticket_payments: [],
    ...overrides,
  }) as ReceiptPdfTicket;

const presupuesto = (overrides: Partial<ReceiptPdfTicket> = {}) =>
  baseTicket({ document_kind: 'presupuesto', paid: 0, ...overrides });

describe('receipt pdf formatting', () => {
  it('formats money as $1,234.00 MXN', () => {
    expect(formatReceiptMoney(1234, 'MXN')).toBe('$1,234.00 MXN');
    expect(formatReceiptMoney(0, 'MXN')).toBe('$0.00 MXN');
    expect(formatReceiptMoney(500882.966, 'USD')).toBe('$500,882.97 USD');
    expect(formatReceiptMoney(-50, 'MXN')).toBe('-$50.00 MXN');
  });

  it('pads the folio to six digits', () => {
    expect(formatReceiptFolio(1114n)).toBe('001114');
    expect(formatReceiptFolio(1234567n)).toBe('1234567');
  });

  it('prints quantities without trailing zeros', () => {
    expect(formatReceiptQuantity(1)).toBe('1');
    expect(formatReceiptQuantity(2.5)).toBe('2.5');
    expect(formatReceiptQuantity(0.333)).toBe('0.33');
  });
});

describe('buildReceiptPdfPayload — shared fields', () => {
  it('maps the sample data of the design handoff', () => {
    const payload = buildReceiptPdfPayload(presupuesto({ expires_at: new Date(2026, 10, 9, 12) }));

    expect(payload).toMatchObject({
      docType: 'presupuesto',
      docTitle: 'PRESUPUESTO',
      folio: '001114',
      issueDate: '10 / 10 / 2026',
      validity: { days: 30, expiryDate: '09 / 11 / 2026' },
      itemCount: 2,
      company: {
        name: 'ClimaTotal Demo',
        tagline: 'Climatización · Servicio técnico',
        initial: 'C',
        logoUrl: null,
        phone: '+52 55 4123 8900',
        email: 'contacto@climatotal.demo',
      },
      client: { name: 'Cliente test', phone: '961 315 1552', country: 'México' },
      subtotal: 325,
      total: 325,
      adjustment: null,
      currencyCode: 'MXN',
    });
    expect(payload.company.address).toContain('Av. Insurgentes Sur');
    expect(payload.items.map((item) => item.index)).toEqual(['01', '02']);
    expect(payload.items[1]).toMatchObject({
      name: 'Prueba',
      description: 'Una descripción del servicio',
      quantity: 1,
      unitPrice: 259,
      amount: 259,
      materials: [],
    });
  });

  it('has no tax and no legal note fields', () => {
    const payload = buildReceiptPdfPayload(baseTicket());
    const keys = JSON.stringify(Object.keys(payload)).toLowerCase();
    expect(keys).not.toMatch(/tax|iva|legal|cfdi/);
  });

  it('drops soft-deleted lines and counts the rest', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({
        services_tickets: [
          catalogLine(1, 'A', '', 100),
          catalogLine(2, 'B', '', 200, 1, { deleted_at: new Date() }),
          catalogLine(3, 'C', '', 60.99, 3),
        ],
        total: 282.97,
      }),
    );
    expect(payload.itemCount).toBe(2);
    expect(payload.items.map((item) => [item.index, item.name, item.amount])).toEqual([
      ['01', 'A', 100],
      ['02', 'C', 182.97],
    ]);
    expect(payload.subtotal).toBe(282.97);
    expect(payload.servicesSubtotal).toBe(282.97);
    expect(payload.materialsSubtotal).toBe(0);
  });

  it('prints inline lines with their own name and description', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({
        services_tickets: [
          catalogLine(1, 'ignored', 'ignored', 850, 1, {
            service_id: null,
            service: null,
            name: 'Cambio de capacitor',
            description: '35 µF',
          }),
        ],
        total: 850,
      }),
    );
    expect(payload.items[0]).toMatchObject({
      name: 'Cambio de capacitor',
      description: '35 µF',
    });
  });

  it('reports an adjustment when the total differs from the line sum', () => {
    const payload = buildReceiptPdfPayload(baseTicket({ total: 300 }));
    expect(payload.subtotal).toBe(325);
    expect(payload.adjustment).toBe(-25);
    expect(payload.total).toBe(300);
  });

  it('falls back to the line sum when total is missing', () => {
    const payload = buildReceiptPdfPayload(baseTicket({ total: null }));
    expect(payload.total).toBe(325);
    expect(payload.adjustment).toBeNull();
  });

  it('omits an empty tagline and uses the company initial', () => {
    const ticket = baseTicket();
    ticket.company!.settings = { default_currency: 'USD', tagline: '   ' };
    ticket.company!.name = 'éxito Clima';
    const payload = buildReceiptPdfPayload(ticket);
    expect(payload.company.tagline).toBeNull();
    expect(payload.company.initial).toBe('É');
    expect(payload.currencyCode).toBe('USD');
  });

  it('uses the ticket phone first, then the client phone, and a default client name', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({ client_tel: ' ', client_name: null }),
    );
    expect(payload.client.phone).toBe('000');
    expect(payload.client.name).toBe('Cliente');
  });
});

describe('buildReceiptPdfPayload — presupuesto', () => {
  const statuses: Array<[string, Partial<ReceiptPdfTicket>]> = [
    ['vigente', { expires_at: new Date(2026, 10, 9, 12) }],
    ['vencido', { expires_at: new Date(2026, 9, 11, 12) }],
    ['convertido', { converted_to_ticket_id: 2000n, expires_at: new Date(2026, 10, 9, 12) }],
    ['cancelado', { canceled_at: new Date(2026, 9, 12), expires_at: new Date(2026, 10, 9, 12) }],
  ];

  it.each(statuses)('prints no Estado when %s', (_status, overrides) => {
    const payload = buildReceiptPdfPayload(
      presupuesto(overrides),
      new Date(2026, 11, 1),
    );
    expect(payload.recibo).toBeNull();
    expect(payload.paid).toBeNull();
    expect(payload.balanceDue).toBeNull();
    expect(payload.bigFigure).toEqual({ label: 'Total del presupuesto', value: 325 });
    expect(payload.validity).not.toBeNull();
  });

  it('computes vigencia days and vence date', () => {
    const payload = buildReceiptPdfPayload(
      presupuesto({ expires_at: new Date(2026, 9, 25, 9) }),
    );
    expect(payload.validity).toEqual({ days: 15, expiryDate: '25 / 10 / 2026' });
  });

  it('has no validity without expires_at (Sin vencimiento)', () => {
    expect(buildReceiptPdfPayload(presupuesto()).validity).toBeNull();
  });

  it('ignores paid amounts on a presupuesto', () => {
    const payload = buildReceiptPdfPayload(presupuesto({ paid: 100 }));
    expect(payload.bigFigure.value).toBe(325);
    expect(payload.paid).toBeNull();
  });
});

describe('buildReceiptPdfPayload — recibo', () => {
  it('is pending with a balance', () => {
    const payload = buildReceiptPdfPayload(baseTicket({ paid: 100 }));
    expect(payload.docTitle).toBe('RECIBO');
    expect(payload.validity).toBeNull();
    expect(payload.recibo).toEqual({ statusLabel: 'Pendiente de pago', paidOnDate: null });
    expect(payload.paid).toBe(100);
    expect(payload.balanceDue).toBe(225);
    expect(payload.bigFigure).toEqual({ label: 'Saldo por pagar', value: 225 });
  });

  it('is paid on the date of the last payment', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({
        paid: 325,
        ticket_payments: [
          { id: 1, ticket_id: 1114n, amount: 100, company_id: 4, created_at: new Date(2026, 9, 11, 10) },
          { id: 2, ticket_id: 1114n, amount: 225, company_id: 4, created_at: new Date(2026, 9, 14, 10) },
        ],
      }),
    );
    expect(payload.recibo).toEqual({ statusLabel: 'Pagado', paidOnDate: '14 / 10 / 2026' });
    expect(payload.balanceDue).toBe(0);
    expect(payload.bigFigure).toEqual({ label: 'Saldo por pagar', value: 0 });
  });

  it('is paid without payment rows (legacy paid column), dated by updated_at', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({ paid: 400, updated_at: new Date(2026, 9, 12, 10) }),
    );
    expect(payload.recibo).toEqual({ statusLabel: 'Pagado', paidOnDate: '12 / 10 / 2026' });
    expect(payload.paid).toBe(400);
    expect(payload.balanceDue).toBe(0);
  });

  it('a zero-total recibo is pending, not paid', () => {
    const payload = buildReceiptPdfPayload(
      baseTicket({ services_tickets: [], total: 0 }),
    );
    expect(payload.itemCount).toBe(0);
    expect(payload.recibo?.statusLabel).toBe('Pendiente de pago');
  });
});

describe('buildReceiptPdfPayload — materials (ZIG-I10)', () => {
  const withMaterials = (materials: NonNullable<Line['materials']>) =>
    ({ ...catalogLine(1, 'Instalación', 'Minisplit', 1200), materials }) as Line;

  it('lists active materials in sort order and adds them to the line amount', () => {
    const payload = buildReceiptPdfPayload(
      presupuesto({
        services_tickets: [
          withMaterials([
            { name: 'Cinta', unit: null, quantity: '1', price: '35.00', sort_order: 2 },
            { name: null, material: { name: 'Gas R410A' }, unit: 'kg', quantity: 2, price: 450, sort_order: 1 },
            { name: 'Borrado', unit: 'pz', quantity: 1, price: 999, sort_order: 0, deleted_at: new Date() },
            { name: 'Tubería', unit: 'm', quantity: '2.5', price: '85.5', sort_order: 1 },
          ]),
          catalogLine(2, 'Diagnóstico', '', 300),
        ],
        total: 2723.75,
      }),
    );

    expect(payload.items[0].materials).toEqual([
      { name: 'Gas R410A', quantity: 2, unit: 'kg', unitPrice: 450, amount: 900 },
      { name: 'Tubería', quantity: 2.5, unit: 'm', unitPrice: 85.5, amount: 213.75 },
      { name: 'Cinta', quantity: 1, unit: null, unitPrice: 35, amount: 35 },
    ]);
    expect(payload.items[0]).toMatchObject({ serviceAmount: 1200, amount: 2348.75, unitPrice: 1200 });
    expect(payload.items[1]).toMatchObject({ serviceAmount: 300, amount: 300, materials: [] });
    expect(payload).toMatchObject({
      servicesSubtotal: 1500,
      materialsSubtotal: 1148.75,
      subtotal: 2648.75,
      adjustment: 75,
    });
  });

  it('has a zero materials subtotal without materials', () => {
    const payload = buildReceiptPdfPayload(baseTicket());
    expect(payload.materialsSubtotal).toBe(0);
    expect(payload.servicesSubtotal).toBe(payload.subtotal);
  });
});
