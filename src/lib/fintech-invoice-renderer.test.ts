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
});
