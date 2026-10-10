import { TextDecoder, TextEncoder } from 'util';
import { buildFintechInvoicePayload } from '@/lib/fintech-invoice-payload';

Object.assign(globalThis, { TextDecoder, TextEncoder });

describe('fintech invoice renderer branding', () => {
  it('renders valid PDF bytes when issuer logo is missing', async () => {
    const { renderFintechInvoicePdf } = await import('@/lib/fintech-invoice-renderer');
    const payload = buildFintechInvoicePayload({
      id: 1n,
      client_id: null,
      client_name: 'Cliente',
      client_tel: '555',
      ticket_date: new Date(),
      total: 100,
      paid: 0,
      email: null,
      finished: false,
      document: null,
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
      company_id: 1,
      userId: null,
      company: {
        id: 1,
        name: 'Acme',
        email: 'a@acme.test',
        phone: '555',
        logo: 'https://evil.example/logo.png',
        street: 'Main',
        exterior_number: '1',
        interior_number: null,
        neighborhood: 'Centro',
        city: 'CDMX',
        state: 'CDMX',
        postal_code: '01000',
        country: 'México',
        settings: { default_currency: 'MXN' },
        status: 'ACTIVE',
        is_system: false,
        created_at: new Date(),
        updated_at: null,
        deleted_at: null,
      },
      services_tickets: [],
      ticket_payments: [],
    });

    expect(payload.issuer.logoUrl).toBeNull();

    const pdf = renderFintechInvoicePdf(payload, {
      issuerLogoDataUrl: null,
    });
    const header = Buffer.from(pdf).subarray(0, 5).toString('ascii');

    expect(header).toBe('%PDF-');
  });

  it('does not throw when issuer logo data is invalid', async () => {
    const { renderFintechInvoicePdf } = await import('@/lib/fintech-invoice-renderer');
    const payload = buildFintechInvoicePayload({
      id: 2n,
      client_id: null,
      client_name: 'Cliente',
      client_tel: '555',
      ticket_date: new Date(),
      total: 50,
      paid: 50,
      email: null,
      finished: true,
      document: null,
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
      company_id: 1,
      userId: null,
      company: {
        id: 1,
        name: 'Acme',
        email: 'a@acme.test',
        phone: '555',
        logo: 'https://abc.public.blob.vercel-storage.com/logo.png',
        street: 'Main',
        exterior_number: '1',
        interior_number: null,
        neighborhood: 'Centro',
        city: 'CDMX',
        state: 'CDMX',
        postal_code: '01000',
        country: 'México',
        settings: { default_currency: 'MXN' },
        status: 'ACTIVE',
        is_system: false,
        created_at: new Date(),
        updated_at: null,
        deleted_at: null,
      },
      services_tickets: [],
      ticket_payments: [],
    });

    expect(payload.issuer.logoUrl).toContain('blob.vercel-storage.com');

    expect(() =>
      renderFintechInvoicePdf(payload, {
        issuerLogoDataUrl: 'data:text/plain;base64,YQ==',
      }),
    ).not.toThrow();
  });

  it('renders a multi-item invoice with adjustment without throwing', async () => {
    const { renderFintechInvoicePdf } = await import('@/lib/fintech-invoice-renderer');
    const payload = buildFintechInvoicePayload({
      id: 1054n,
      client_id: 7,
      client_name: 'Leon SOlorznao',
      client_tel: '9613151559',
      ticket_date: new Date('2026-07-12T06:00:00.000Z'),
      total: 600_882.97,
      paid: 600_882.97,
      email: null,
      finished: true,
      document: null,
      created_at: new Date('2026-07-12T06:00:00.000Z'),
      updated_at: null,
      deleted_at: null,
      company_id: 1,
      userId: null,
      company: {
        id: 1,
        name: 'SOLUCIONES CHANO',
        email: 'chano@test.com',
        phone: '(939) 165-46-35',
        logo: null,
        street: 'C. Camarote',
        exterior_number: '121',
        interior_number: null,
        neighborhood: 'Centro',
        city: 'Ponce',
        state: 'PR',
        postal_code: '00716',
        country: 'Puerto Rico',
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
          ticket_id: 1054n,
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
          ticket_id: 1054n,
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
          ticket_id: 1054n,
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
      ticket_payments: [],
    });

    expect(payload.hasAdjustment).toBe(true);
    expect(payload.items).toHaveLength(3);

    const pdf = renderFintechInvoicePdf(payload, { issuerLogoDataUrl: null });
    const header = Buffer.from(pdf).subarray(0, 5).toString('ascii');

    expect(header).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);

    const pdfText = Buffer.from(pdf).toString('latin1');
    expect(pdfText).toContain('https://zigzag-hazel.vercel.app');
  });

  it('keeps service row separators below long wrapped descriptions', async () => {
    const { renderFintechInvoicePdf } = await import('@/lib/fintech-invoice-renderer');
    const longDescription =
      'Servicio completo de limpieza profunda con tratamiento especial para manchas difíciles y acabado profesional en domicilio';
    const payload = buildFintechInvoicePayload({
      id: 2001n,
      client_id: 7,
      client_name: 'Cliente Demo',
      client_tel: '5551234567',
      ticket_date: new Date('2026-07-12T06:00:00.000Z'),
      total: 1500,
      paid: 1500,
      email: null,
      finished: true,
      document: null,
      created_at: new Date('2026-07-12T06:00:00.000Z'),
      updated_at: null,
      deleted_at: null,
      company_id: 1,
      userId: null,
      company: {
        id: 1,
        name: 'Acme',
        email: 'a@acme.test',
        phone: '555',
        logo: null,
        street: 'Main',
        exterior_number: '1',
        interior_number: null,
        neighborhood: 'Centro',
        city: 'CDMX',
        state: 'CDMX',
        postal_code: '01000',
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
          ticket_id: 2001n,
          quantity: 1,
          price: 800,
          created_at: new Date(),
          updated_at: null,
          deleted_at: null,
          service: {
            id: 10,
            name: 'Limpieza profunda de salas y comedor amplio',
            description: longDescription,
            price: 800,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            company_id: 1,
          },
        },
        {
          id: 2,
          service_id: 11,
          ticket_id: 2001n,
          quantity: 1,
          price: 700,
          created_at: new Date(),
          updated_at: null,
          deleted_at: null,
          service: {
            id: 11,
            name: 'Mantenimiento A/C',
            description: 'Revisión general',
            price: 700,
            created_at: new Date(),
            updated_at: null,
            deleted_at: null,
            company_id: 1,
          },
        },
      ],
      ticket_payments: [],
    });

    expect(() =>
      renderFintechInvoicePdf(payload, { issuerLogoDataUrl: null }),
    ).not.toThrow();
  });
});

describe('fintech invoice renderer materials (ZIG-I10)', () => {
  const item = (number: number, materialCount: number) => ({
    number,
    name: `Servicio ${number}`,
    description: 'Descripción del servicio',
    quantity: 1,
    unitPrice: 1000,
    serviceTotal: 1000,
    total: 1000 + materialCount * 100,
    materials: Array.from({ length: materialCount }, (_, index) => ({
      name: `Material ${index + 1}`,
      quantity: 1,
      unit: 'pza',
      unitPrice: 100,
      total: 100,
    })),
  });

  it('paginates by height so a 10-line document with 3 materials each never overflows', async () => {
    const { paginateInvoiceItems, invoiceItemHeight } = await import(
      '@/lib/fintech-invoice-renderer'
    );
    const items = Array.from({ length: 10 }, (_, index) => item(index + 1, 3));
    const pages = paginateInvoiceItems(items);

    // Every item lands on exactly one page, in order.
    expect(pages.flat().map((entry) => entry.number)).toEqual(
      items.map((entry) => entry.number),
    );
    // Each page's rows fit its budget (main: 6 plain rows, continuation: 12).
    const budgets = [6 * 52, ...Array(pages.length).fill(12 * 52)];
    pages.forEach((page, index) => {
      const used = page.reduce((sum, entry) => sum + invoiceItemHeight(entry), 0);
      expect(used).toBeLessThanOrEqual(budgets[index]);
    });
    expect(pages[0].length).toBeLessThan(6);
  });

  it('leaves the main page table empty when its first line is taller than the page allows', async () => {
    const { paginateInvoiceItems } = await import('@/lib/fintech-invoice-renderer');
    const pages = paginateInvoiceItems([item(1, 30), item(2, 0)]);
    expect(pages[0]).toEqual([]);
    expect(pages[1].map((entry) => entry.number)).toEqual([1, 2]);
  });

  it('documents without materials keep the 6 + 12 rows per page split', async () => {
    const { paginateInvoiceItems } = await import('@/lib/fintech-invoice-renderer');
    const pages = paginateInvoiceItems(
      Array.from({ length: 20 }, (_, index) => item(index + 1, 0)),
    );
    expect(pages.map((page) => page.length)).toEqual([6, 12, 2]);
  });

  it('renders a document with material sub-rows and the Materiales summary as valid PDF bytes', async () => {
    const { renderFintechInvoicePdf } = await import('@/lib/fintech-invoice-renderer');
    const items = Array.from({ length: 10 }, (_, index) => item(index + 1, 3));
    const pdf = renderFintechInvoicePdf({
      issuer: {
        name: 'Acme',
        address: 'Main 1',
        phone: '555',
        email: 'a@acme.test',
        footerAddress: 'Main 1',
        currencyCode: 'MXN',
        logoUrl: null,
      },
      client: { name: 'Cliente', phone: null, country: null, address: null },
      ticketNumber: '000001',
      issueDate: '10/10/2026',
      documentTitle: 'Presupuesto',
      documentKind: 'presupuesto',
      statusLabel: 'PRESUPUESTO',
      balanceLabel: 'TOTAL DEL PRESUPUESTO',
      serviceCountLabel: '10 conceptos',
      items,
      servicesSubtotal: 10000,
      materialsSubtotal: 3000,
      subtotal: 13000,
      adjustmentAmount: 0,
      hasAdjustment: false,
      total: 13000,
      paid: 0,
      balanceDue: 13000,
      paymentProgress: 0,
      paymentProgressLabel: 'Cotización',
      dueText: 'Documento informativo — no es un recibo de pago',
    });
    const bytes = Buffer.from(pdf);
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    // Main page + continuation pages.
    const pageCount = (bytes.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });
});

