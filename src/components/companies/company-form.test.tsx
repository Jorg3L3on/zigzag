import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CompanyForm } from '@/components/companies/company-form';
import { updateCompany, updateOwnCompany } from '@/actions/companies';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsDesktop } from '@/hooks/use-desktop';
import type { Company } from '@/db/schema';

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: jest.fn(() => true) }));
jest.mock('@/hooks/use-desktop', () => ({ useIsDesktop: jest.fn(() => false) }));

jest.mock('@/actions/companies', () => ({
  createCompany: jest.fn(),
  updateCompany: jest.fn(),
  updateOwnCompany: jest.fn(),
}));

jest.mock('@/components/companies/company-logo-upload', () => ({
  CompanyLogoUpload: () => <div data-testid="logo-upload" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const mockUseIsDesktop = useIsDesktop as jest.MockedFunction<typeof useIsDesktop>;
const mockUpdateOwnCompany = updateOwnCompany as jest.MockedFunction<
  typeof updateOwnCompany
>;
const mockUpdateCompany = updateCompany as jest.MockedFunction<typeof updateCompany>;

const company = {
  id: 4,
  name: 'ClimaTotal Demo',
  email: 'hola@clima.mx',
  phone: '9991234567',
  logo: null,
  street: 'Av. Juárez',
  interior_number: null,
  exterior_number: '120',
  neighborhood: 'Centro',
  city: 'Mérida',
  state: 'Yucatán',
  country: 'México',
  postal_code: '97000',
  status: 'ACTIVE',
  settings: {
    tagline: 'Climatización · Servicio técnico',
    rfc: 'CTD010101AAA',
    default_currency: 'MXN',
    experience_mode: 'auto',
  },
  is_system: false,
} as unknown as Company;

const section = (key: string) => screen.getByTestId(`company-form-section-${key}`);
const desktopCard = (id: string) => screen.getByTestId(`company-datos-${id}`);

describe('CompanyForm sections (ZIG-I3-2)', () => {
  beforeAll(() => {
    // jsdom does not implement scrollIntoView.
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUseIsMobile.mockReturnValue(true);
    mockUseIsDesktop.mockReturnValue(false);
    mockUpdateOwnCompany.mockResolvedValue({ success: true });
  });

  it('opens General and collapses Dirección and Configuración with summaries on mobile', () => {
    render(<CompanyForm company={company} mode="self" />);

    expect(within(section('general')).getByLabelText('Nombre')).toBeVisible();
    expect(
      within(section('direccion')).getByText('Av. Juárez 120, Centro, Mérida, CP 97000'),
    ).toBeInTheDocument();
    expect(within(section('direccion')).getByLabelText('Calle')).not.toBeVisible();
    expect(
      within(section('configuracion')).getByText('RFC CTD010101AAA · MXN · Inicio automático'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mobile-sticky-action-bar')).toHaveTextContent(
      'Guardar cambios',
    );
  });

  it('opens the closed section that holds the first error and focuses the field', async () => {
    render(<CompanyForm company={company} mode="self" />);

    fireEvent.change(within(section('direccion')).getByLabelText('Calle'), {
      target: { value: '' },
    });
    fireEvent.click(
      within(screen.getByTestId('mobile-sticky-action-bar')).getByRole('button', {
        name: 'Guardar cambios',
      }),
    );

    await waitFor(() =>
      expect(within(section('direccion')).getByLabelText('Calle')).toBeVisible(),
    );
    await waitFor(() =>
      expect(within(section('direccion')).getByLabelText('Calle')).toHaveFocus(),
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(mockUpdateOwnCompany).not.toHaveBeenCalled();
  });

  it('does not offer Estado de la empresa to the owner on phones; the operator keeps it', () => {
    const { unmount } = render(<CompanyForm company={company} mode="self" />);
    expect(screen.queryByLabelText('Estado de la empresa')).toBeNull();
    unmount();

    render(<CompanyForm company={company} />);
    expect(screen.getByLabelText('Estado de la empresa')).toBeInTheDocument();
  });

  it('remembers which sections were open', () => {
    const { unmount } = render(<CompanyForm company={company} mode="self" />);
    fireEvent.click(within(section('configuracion')).getByRole('button', { name: /Configuración/ }));
    unmount();

    render(<CompanyForm company={company} mode="self" />);
    expect(within(section('configuracion')).getByLabelText('RFC')).toBeVisible();
  });

  it('keeps the operator form flat (no collapsibles, inline submit)', () => {
    render(<CompanyForm company={company} />);

    expect(
      within(section('direccion')).queryByRole('button', { name: /Dirección/ }),
    ).toBeNull();
    expect(within(section('direccion')).getByLabelText('Calle')).toBeVisible();
    expect(screen.queryByTestId('mobile-sticky-action-bar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  });

  it('keeps typed values when the viewport switches between phone and desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseIsDesktop.mockReturnValue(true);
    const { rerender } = render(<CompanyForm company={company} mode="self" />);
    fireEvent.change(within(desktopCard('documentos')).getByLabelText('RFC'), {
      target: { value: 'XAXX010101000' },
    });

    mockUseIsMobile.mockReturnValue(true);
    mockUseIsDesktop.mockReturnValue(false);
    rerender(<CompanyForm company={company} mode="self" />);

    expect(within(section('configuracion')).getByLabelText('RFC')).toHaveValue('XAXX010101000');
  });

  it('edits Lema o giro with a counter, saves it and rejects 61 characters', async () => {
    render(<CompanyForm company={company} mode="self" />);

    const input = within(section('configuracion')).getByLabelText('Lema o giro');
    expect(input).toHaveValue('Climatización · Servicio técnico');
    expect(input).toHaveAttribute('placeholder', 'Climatización · Servicio técnico');
    expect(
      within(section('configuracion')).getByText(
        'Aparece bajo el nombre en tus presupuestos y recibos',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('company-tagline-counter')).toHaveTextContent('32/60');

    fireEvent.change(input, { target: { value: 'a'.repeat(61) } });
    expect(screen.getByTestId('company-tagline-counter')).toHaveTextContent('61/60');
    fireEvent.submit(document.getElementById('company-form')!);
    expect(await screen.findByText(/Máximo 60 caracteres/)).toBeInTheDocument();
    expect(mockUpdateOwnCompany).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.submit(document.getElementById('company-form')!);
    await waitFor(() => expect(mockUpdateOwnCompany).toHaveBeenCalled());
    expect(mockUpdateOwnCompany.mock.calls[0][0]).toMatchObject({
      settings: { tagline: '' },
    });
  });

  it('saves Lema o giro from the operator company form too', async () => {
    mockUpdateCompany.mockResolvedValue({ success: true } as Awaited<ReturnType<typeof updateCompany>>);
    render(<CompanyForm company={company} />);
    // Notas al pie de recibo was dropped: no PDF ever printed it.
    expect(screen.queryByLabelText('Notas al pie de recibo')).toBeNull();

    fireEvent.change(screen.getByLabelText('Lema o giro'), {
      target: { value: 'Plomería y gas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mockUpdateCompany).toHaveBeenCalled());
    expect(mockUpdateCompany.mock.calls[0]).toContainEqual(
      expect.objectContaining({ settings: expect.objectContaining({ tagline: 'Plomería y gas' }) }),
    );
  });

  it('saves banco, titular y CLABE from Para pagar por transferencia and rejects a bad CLABE', async () => {
    mockUpdateOwnCompany.mockResolvedValue({ success: true } as Awaited<ReturnType<typeof updateOwnCompany>>);
    render(<CompanyForm company={company} mode="self" />);

    const pago = section('pago');
    expect(within(pago).getByText('Para pagar por transferencia')).toBeInTheDocument();
    fireEvent.change(within(pago).getByLabelText('Banco'), { target: { value: 'BBVA' } });
    fireEvent.change(within(pago).getByLabelText('A nombre de'), { target: { value: 'Juan Pérez' } });
    fireEvent.change(within(pago).getByLabelText('CLABE'), {
      target: { value: '0020 1007 7777 7777 72' },
    });
    fireEvent.submit(document.getElementById('company-form')!);
    expect(await screen.findByText(/el último dígito no coincide/)).toBeInTheDocument();
    expect(mockUpdateOwnCompany).not.toHaveBeenCalled();

    fireEvent.change(within(pago).getByLabelText('CLABE'), {
      target: { value: '0020 1007 7777 7777 71' },
    });
    fireEvent.change(within(pago).getByLabelText('Indicación para tu cliente'), {
      target: { value: 'Manda tu comprobante por WhatsApp' },
    });
    fireEvent.submit(document.getElementById('company-form')!);
    await waitFor(() => expect(mockUpdateOwnCompany).toHaveBeenCalled());
    expect(mockUpdateOwnCompany.mock.calls[0][0]).toMatchObject({
      settings: {
        payment_bank: 'BBVA',
        payment_holder: 'Juan Pérez',
        payment_clabe: '0020 1007 7777 7777 71',
        payment_note: 'Manda tu comprobante por WhatsApp',
      },
    });
  });

  it('warns on a card and never asks for vencimiento or CVV (ZIG-23)', async () => {
    render(
      <CompanyForm
        company={{
          ...company,
          settings: { ...company.settings, payment_kind: 'card' },
        }}
        mode="self"
      />,
    );

    const pago = section('pago');
    expect(within(pago).getByTestId('card-payment-warning')).toHaveTextContent(/CONDUSEF/);
    expect(within(pago).getByLabelText('Número de tarjeta')).toBeInTheDocument();
    expect(within(pago).queryByLabelText('CLABE')).not.toBeInTheDocument();
    expect(within(pago).queryByLabelText(/vencimiento/i)).not.toBeInTheDocument();
    expect(within(pago).queryByLabelText(/cvv/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/vencimiento/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
  });

  describe('lg+ Datos cards (ZIG-I32-1)', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
      mockUseIsDesktop.mockReturnValue(true);
    });

    it('keeps the tablet layout from 768 to 1023 (flat sections, inline Guardar)', () => {
      mockUseIsDesktop.mockReturnValue(false);
      render(<CompanyForm company={company} mode="self" />);

      expect(screen.queryByTestId('company-datos-perfil')).toBeNull();
      expect(within(section('direccion')).getByLabelText('Calle')).toBeVisible();
    });

    it('shows the five sections as anchored cards, without Estado de la empresa', () => {
      render(
        <CompanyForm
          company={company}
          mode="self"
          nextFolioNumbers={{ presupuesto: 7, ticket: 62 }}
        />,
      );

      for (const id of ['perfil', 'direccion', 'documentos', 'pagos', 'inicio']) {
        expect(desktopCard(id)).toHaveAttribute('id', id);
      }
      expect(screen.queryByLabelText('Estado de la empresa')).toBeNull();
      expect(within(desktopCard('perfil')).getByLabelText('Lema o giro')).toBeInTheDocument();
      expect(screen.getByTestId('company-next-folio-presupuesto')).toHaveTextContent('P-0007');
      expect(screen.getByTestId('company-next-folio-ticket')).toHaveTextContent('R-0062');
      expect(screen.getByRole('radio', { name: /Automático/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'CLABE' })).toBeChecked();
      expect(screen.queryByTestId('form-changes-bar')).toBeNull();
      expect(screen.queryByTestId('mobile-sticky-action-bar')).toBeNull();
    });

    it('updates the preview and the changes bar as the tagline is typed; Descartar restores', () => {
      render(<CompanyForm company={company} mode="self" />);

      fireEvent.change(within(desktopCard('perfil')).getByLabelText('Lema o giro'), {
        target: { value: 'Plomería y gas' },
      });

      expect(screen.getByTestId('receipt-preview-tagline')).toHaveTextContent('Plomería y gas');
      expect(screen.getByTestId('form-changes-bar')).toHaveTextContent(
        'Cambios sin guardar · Lema o giro',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      expect(screen.queryByTestId('form-changes-bar')).toBeNull();
      expect(within(desktopCard('perfil')).getByLabelText('Lema o giro')).toHaveValue(
        'Climatización · Servicio técnico',
      );
      expect(screen.getByTestId('receipt-preview-tagline')).toHaveTextContent(
        'Climatización · Servicio técnico',
      );
    });

    it('saves once from the bar, keeps the status and closes the bar', async () => {
      mockUpdateOwnCompany.mockResolvedValue({ success: true } as Awaited<
        ReturnType<typeof updateOwnCompany>
      >);
      render(<CompanyForm company={company} mode="self" />);

      fireEvent.change(within(desktopCard('direccion')).getByLabelText('Colonia'), {
        target: { value: 'Itzimná' },
      });
      fireEvent.click(screen.getByRole('radio', { name: /Oficina/ }));
      expect(screen.getByTestId('form-changes-bar')).toHaveTextContent('Colonia, Inicio');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(mockUpdateOwnCompany).toHaveBeenCalledTimes(1));
      expect(mockUpdateOwnCompany.mock.calls[0][0]).toMatchObject({
        status: 'ACTIVE',
        neighborhood: 'Itzimná',
        settings: { experience_mode: 'office' },
      });
      await waitFor(() => expect(screen.queryByTestId('form-changes-bar')).toBeNull());
    });

    it('switches the payment number by method chip and shows it in the WhatsApp preview', () => {
      render(<CompanyForm company={company} mode="self" />);
      const pagos = desktopCard('pagos');

      fireEvent.change(within(pagos).getByLabelText('Banco'), { target: { value: 'BBVA' } });
      fireEvent.click(within(pagos).getByRole('radio', { name: 'Cuenta' }));
      expect(within(pagos).getByLabelText('Número de cuenta')).toBeInTheDocument();
      expect(within(pagos).queryByRole('textbox', { name: 'CLABE' })).toBeNull();
      expect(screen.getByTestId('receipt-preview-whatsapp')).toHaveTextContent(
        'Para pagar a la cuenta:',
      );
      expect(screen.getByTestId('receipt-preview-whatsapp')).toHaveTextContent('Banco BBVA');
    });

    it('focuses the first invalid field on save', async () => {
      render(<CompanyForm company={company} mode="self" />);
      const street = within(desktopCard('direccion')).getByLabelText('Calle');

      fireEvent.change(street, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(street).toHaveFocus());
      expect(mockUpdateOwnCompany).not.toHaveBeenCalled();
    });
  });
});
