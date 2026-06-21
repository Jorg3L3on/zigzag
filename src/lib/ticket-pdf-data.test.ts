import type { TicketDetailData } from '@/actions/tickets';
import {
  buildInvoiceDataFromTicketDetail,
  buildTicketPdfFileName,
} from '@/lib/ticket-pdf-data';

const baseTicket = {
  id: 42n,
  client_id: 1,
  client_name: 'Acme Corp',
  client_tel: '555-0100',
  email: 'billing@acme.test',
  document: null,
  ticket_date: new Date('2026-03-15T12:00:00.000Z'),
  total: 150,
  paid: 50,
  finished: true,
  created_at: new Date('2026-03-15T10:00:00.000Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 10,
  userId: 1n,
  company: {
    id: 10,
    name: 'Soluciones Chano',
    email: 'contacto@example.test',
    phone: '939-000-0000',
    logo: null,
    street: 'C. Camarote #121',
    exterior_number: '121',
    interior_number: null,
    neighborhood: 'Centro',
    city: 'México',
    state: 'CDMX',
    country: 'México',
    postal_code: '01000',
    status: 'ACTIVE',
    is_system: false,
    settings: { default_currency: 'MXN' },
    deleted_at: null,
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    updated_at: null,
  },
  services_tickets: [
    {
      id: 1,
      ticket_id: 42n,
      service_id: 5,
      quantity: 2,
      price: 50,
      deleted_at: null,
      created_at: new Date('2026-03-15T10:00:00.000Z'),
      updated_at: null,
      service: {
        id: 5,
        name: 'Lavado',
        description: 'Lavado completo',
        price: 50,
        company_id: 10,
        deleted_at: null,
        created_at: new Date('2025-01-01T00:00:00.000Z'),
        updated_at: null,
      },
    },
    {
      id: 2,
      ticket_id: 42n,
      service_id: 6,
      quantity: 1,
      price: 50,
      deleted_at: null,
      created_at: new Date('2026-03-15T10:00:00.000Z'),
      updated_at: null,
      service: null,
    },
  ],
} as TicketDetailData;

describe('ticket PDF data', () => {
  it('builds invoice line items and totals from ticket detail', () => {
    const invoice = buildInvoiceDataFromTicketDetail(baseTicket);

    expect(invoice.clientName).toBe('Acme Corp');
    expect(invoice.clientAddress).toBe('555-0100');
    expect(invoice.ticketNumber).toBe('000042');
    expect(invoice.issueDate).toBe('15/03/2026');
    expect(invoice.items).toHaveLength(2);
    expect(invoice.items[0]).toMatchObject({
      description: 'Lavado|||Lavado completo',
      quantity: '2',
      unitPrice: '50.00',
      total: '100.00',
    });
    expect(invoice.items[1]?.description).toBe('Servicio|||');
    expect(invoice.total).toBe('150.00');
    expect(invoice.paidAmount).toBe('50.00');
    expect(invoice.issuer.currencyCode).toBe('MXN');
  });

  it('derives total from service lines when ticket total is missing', () => {
    const invoice = buildInvoiceDataFromTicketDetail({
      ...baseTicket,
      total: null,
    });

    expect(invoice.total).toBe('150.00');
  });

  it('builds a filesystem-safe PDF filename', () => {
    expect(buildTicketPdfFileName(baseTicket)).toBe(
      'Acme Corp_2026-03-15_42.pdf',
    );
  });

  it('falls back when client name has unsafe characters', () => {
    const fileName = buildTicketPdfFileName({
      ...baseTicket,
      client_name: '***',
    });

    expect(fileName).toBe('ticket_2026-03-15_42.pdf');
  });
});
