import {
  buildFintechInvoicePayload,
  formatTicketNumber,
  type FintechInvoiceTicket,
} from '@/lib/fintech-invoice-payload';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextDecoder, TextEncoder });

const baseTicket = (overrides: Partial<FintechInvoiceTicket> = {}) =>
  ({
    id: 2n,
    client_id: 7,
    client_name: 'TELMEX 1',
    client_tel: '9613151559',
    ticket_date: new Date('2025-06-08T06:00:00.000Z'),
    total: 250,
    paid: 100,
    email: 'client@example.com',
    finished: true,
    document: null,
    created_at: new Date('2025-06-08T06:00:00.000Z'),
    updated_at: null,
    deleted_at: null,
    company_id: 1,
    userId: null,
    company: {
      id: 1,
      name: 'ZIGZAG',
      email: 'zigzag@test.com',
      phone: '(939) 165-46-35',
      logo: null,
      street: 'C. Camarote',
      exterior_number: '121',
      interior_number: null,
      neighborhood: 'Centro',
      city: 'Tuxtla',
      state: 'Chiapas',
      postal_code: '29000',
      country: 'México',
      settings: { default_currency: 'MXN' },
      status: 'ACTIVE',
      is_system: false,
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
    },
    services_tickets: [
      {
        id: 1,
        service_id: 10,
        ticket_id: 2n,
        quantity: 1,
        price: 250,
        created_at: new Date(),
        updated_at: null,
        deleted_at: null,
        service: {
          id: 10,
          name: 'Diagnóstico general',
          description: 'Inspección y diagnóstico',
          price: 250,
          created_at: new Date(),
          updated_at: null,
          deleted_at: null,
          company_id: 1,
        },
      },
    ],
    ticket_payments: [],
    ...overrides,
  }) as FintechInvoiceTicket;

describe('fintech invoice payload', () => {
  it('formats bigint ticket IDs with leading zeroes', () => {
    expect(formatTicketNumber(2n)).toBe('000002');
    expect(formatTicketNumber(1234567n)).toBe('1234567');
  });

  it('builds dynamic payment fields for a partial payment', () => {
    const payload = buildFintechInvoicePayload(baseTicket());

    expect(payload.ticketNumber).toBe('000002');
    expect(payload.statusLabel).toBe('PENDIENTE');
    expect(payload.balanceLabel).toBe('SALDO PENDIENTE');
    expect(payload.paymentProgress).toBeCloseTo(0.4, 5);
    expect(payload.paymentProgressLabel).toBe('40% pagado');
    expect(payload.balanceDue).toBe(150);
    expect(payload.serviceCountLabel).toBe('1 concepto facturado');
  });

  it('marks paid or overpaid tickets as covered without negative balance', () => {
    const payload = buildFintechInvoicePayload(
      baseTicket({ total: 250, paid: 300 }),
    );

    expect(payload.statusLabel).toBe('SALDADO');
    expect(payload.balanceLabel).toBe('TOTAL DEL TICKET');
    expect(payload.paymentProgress).toBe(1);
    expect(payload.balanceDue).toBe(0);
    expect(payload.hasAdjustment).toBe(false);
  });

  it('exposes adjustment when ticket total differs from line items', () => {
    const payload = buildFintechInvoicePayload(
      baseTicket({
        total: 600_882.97,
        paid: 600_882.97,
        services_tickets: [
          {
            id: 1,
            service_id: 10,
            ticket_id: 2n,
            quantity: 1,
            price: 500_000,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            service: {
              id: 10,
              name: 'Limpieza juego de salas',
              description: 'Limpieza profunda',
              price: 500_000,
              created_at: new Date(),
              updated_at: null,
              deleted_at: null,
              company_id: 1,
            },
          },
          {
            id: 2,
            service_id: 11,
            ticket_id: 2n,
            quantity: 1,
            price: 700,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            service: {
              id: 11,
              name: 'Mantenimiento A/C',
              description: 'Description for Mantenimiento A/C',
              price: 700,
              created_at: new Date(),
              updated_at: null,
              deleted_at: null,
              company_id: 1,
            },
          },
          {
            id: 3,
            service_id: 12,
            ticket_id: 2n,
            quantity: 3,
            price: 60.99,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            service: {
              id: 12,
              name: 'Limpiar alfombras',
              description: 'Alfombras limpias',
              price: 60.99,
              created_at: new Date(),
              updated_at: null,
              deleted_at: null,
              company_id: 1,
            },
          },
        ],
      }),
    );

    expect(payload.subtotal).toBe(500_882.97);
    expect(payload.total).toBe(600_882.97);
    expect(payload.adjustmentAmount).toBe(100_000);
    expect(payload.hasAdjustment).toBe(true);
  });

  it('uses linked client country when available', () => {
    const payload = buildFintechInvoicePayload(
      baseTicket({
        client: {
          id: 7,
          name: 'TELMEX 1',
          email: null,
          phone: '9613151559',
          document: null,
          address: null,
          street: null,
          exterior_number: null,
          interior_number: null,
          neighborhood: null,
          city: null,
          state: null,
          postal_code: null,
          country: 'Puerto Rico',
          created_at: new Date(),
          updated_at: null,
          deleted_at: null,
          company_id: 1,
        },
      }),
    );

    expect(payload.client.country).toBe('Puerto Rico');
  });

  it('falls back cleanly when optional company, client, and service data is missing', () => {
    const payload = buildFintechInvoicePayload(
      baseTicket({
        client_id: null,
        client_name: null,
        client_tel: null,
        company: null,
        total: null,
        paid: null,
        services_tickets: [
          {
            id: 1,
            service_id: 10,
            ticket_id: 2n,
            quantity: 2,
            price: 50,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            service: null,
          },
        ],
      }),
    );

    expect(payload.client.name).toBe('Cliente');
    expect(payload.client.phone).toBe('Sin teléfono');
    expect(payload.client.country).toBeNull();
    expect(payload.issuer.name).toBe('SOLUCIONES CHANO');
    expect(payload.issuer.logoUrl).toBeNull();
    expect(payload.total).toBe(100);
    expect(payload.items[0]).toMatchObject({
      name: 'Servicio',
      description: '',
      quantity: 2,
      unitPrice: 50,
      total: 100,
    });
  });

  it('renders the payload to valid PDF bytes', async () => {
    const { renderFintechInvoicePdf } = await import(
      '@/lib/fintech-invoice-renderer'
    );
    const payload = buildFintechInvoicePayload(baseTicket());
    const pdf = renderFintechInvoicePdf(payload, { issuerLogoDataUrl: null });
    const header = Buffer.from(pdf).subarray(0, 5).toString('ascii');

    expect(header).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
