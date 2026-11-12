import { render, screen, within } from '@testing-library/react';
import {
  buildCompanyReceiptPreview,
  CompanyReceiptPreview,
  mergeCompanyFormValues,
} from '@/components/companies/company-receipt-preview';
import type { Company } from '@/db/schema';
import type { CompanyBootstrapFormValues } from '@/lib/company-schema';
import { buildReceiptPdfPayload, type ReceiptPdfTicket } from '@/lib/receipt-pdf/payload';

const company = {
  id: 4,
  name: 'ClimaTotal Demo',
  email: 'contacto@climatotal.demo',
  phone: '+52 55 4123 8900',
  logo: null,
  street: 'Av. Insurgentes Sur',
  exterior_number: '1602',
  interior_number: 'Piso 8',
  neighborhood: 'Crédito Constructor',
  city: 'Ciudad de México',
  state: 'CDMX',
  postal_code: '03940',
  country: 'México',
  status: 'ACTIVE',
  settings: {
    rfc: 'CTD010101ABC',
    default_currency: 'MXN',
    tagline: 'Climatización · Servicio técnico',
    payment_bank: 'BBVA',
    payment_holder: 'ClimaTotal SA',
    payment_kind: 'clabe',
    payment_clabe: '002010077777777771',
  },
  is_system: false,
  created_at: new Date(),
  updated_at: null,
  deleted_at: null,
} as unknown as Company;

const formValues = (overrides: Partial<CompanyBootstrapFormValues> = {}) =>
  ({
    name: company.name,
    email: company.email,
    phone: company.phone,
    street: company.street,
    interior_number: company.interior_number ?? '',
    exterior_number: company.exterior_number,
    neighborhood: company.neighborhood,
    city: company.city,
    state: company.state,
    country: company.country,
    postal_code: company.postal_code,
    status: 'ACTIVE',
    settings: {
      tagline: company.settings?.tagline ?? '',
      rfc: company.settings?.rfc ?? '',
      default_currency: 'MXN',
      folio_prefix_presupuesto: '',
      folio_prefix_ticket: '',
      experience_mode: 'auto',
      payment_bank: 'BBVA',
      payment_holder: 'ClimaTotal SA',
      payment_kind: 'clabe',
      payment_clabe: '002010077777777771',
      payment_card: '',
      payment_account: '',
      payment_note: '',
    },
    owner: { name: '', email: '', password: '' },
    ...overrides,
  }) as CompanyBootstrapFormValues;

/** A recibo as the invoice route hands it to buildReceiptPdfPayload. */
const realTicket = {
  id: 1114n,
  document_kind: 'ticket',
  folio_number: 62,
  folio_prefix: 'R',
  client_name: 'Cliente',
  client_tel: null,
  ticket_date: new Date(2026, 9, 10, 12),
  total: 325,
  paid: 100,
  work_notes: null,
  company,
  client: null,
  services_tickets: [],
  ticket_payments: [],
} as unknown as ReceiptPdfTicket;

describe('CompanyReceiptPreview (ZIG-I32-1)', () => {
  it('prints the same header and footer as the recibo PDF payload', () => {
    const preview = buildCompanyReceiptPreview(mergeCompanyFormValues(company, formValues()));
    const pdf = buildReceiptPdfPayload(realTicket);

    expect(preview.company).toEqual(pdf.company);
    expect(preview.payment).toEqual(pdf.payment);
  });

  it('shows the typed values before saving', () => {
    render(
      <CompanyReceiptPreview
        company={company}
        values={formValues({ settings: { ...formValues().settings, tagline: 'Plomería y gas' } })}
        nextReceiptFolio="R-0062"
      />,
    );

    expect(screen.getByTestId('receipt-preview-name')).toHaveTextContent('ClimaTotal Demo');
    expect(screen.getByTestId('receipt-preview-tagline')).toHaveTextContent('Plomería y gas');
    const footer = screen.getByTestId('receipt-preview-footer');
    expect(within(footer).getByText('+52 55 4123 8900')).toBeInTheDocument();
    expect(within(footer).getByText('contacto@climatotal.demo')).toBeInTheDocument();
    expect(footer).toHaveTextContent(buildReceiptPdfPayload(realTicket).company.address);
    expect(screen.getByText('Folio R-0062')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-preview-whatsapp')).toHaveTextContent(
      'Para pagar por transferencia:',
    );
    expect(screen.getByTestId('receipt-preview-checks')).toHaveTextContent(
      'Nombre: listoCorreo: listoTeléfono: listoCalle: listo',
    );
  });

  it('lists what is missing to operate and who changes the status', () => {
    render(
      <CompanyReceiptPreview
        company={{ ...company, status: 'SETUP' }}
        values={formValues({ phone: '', settings: { ...formValues().settings, payment_bank: '', payment_holder: '', payment_clabe: '' } })}
        nextReceiptFolio="R-0001"
      />,
    );

    const readiness = screen.getByTestId('receipt-preview-readiness');
    expect(screen.getByTestId('receipt-preview-checks')).toHaveTextContent('Teléfono: falta');
    expect(readiness).toHaveTextContent('Sin datos de pago el recibo no imprime la sección de transferencia.');
    expect(readiness).toHaveTextContent('Estado: En configuración. Lo cambia el equipo de ZigZag.');
    expect(screen.getByTestId('receipt-preview-whatsapp')).toHaveTextContent(
      'Para pagar por transferencia: [Banco] · [Titular] · [CLABE]',
    );
  });
});
