import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CompanyForm } from '@/components/companies/company-form';
import { updateOwnCompany } from '@/actions/companies';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Company } from '@/db/schema';

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: jest.fn(() => true) }));

jest.mock('@/actions/companies', () => ({
  createCompany: jest.fn(),
  updateCompany: jest.fn(),
  updateOwnCompany: jest.fn(),
}));

jest.mock('@/components/companies/company-logo-upload', () => ({
  CompanyLogoUpload: () => <div data-testid="logo-upload" />,
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const mockUpdateOwnCompany = updateOwnCompany as jest.MockedFunction<
  typeof updateOwnCompany
>;

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
    rfc: 'CTD010101AAA',
    default_currency: 'MXN',
    experience_mode: 'auto',
    invoice_footer_note: '',
  },
  is_system: false,
} as unknown as Company;

const section = (key: string) => screen.getByTestId(`company-form-section-${key}`);

describe('CompanyForm sections (ZIG-I3-2)', () => {
  beforeAll(() => {
    // jsdom does not implement scrollIntoView.
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUseIsMobile.mockReturnValue(true);
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

  it('shows every section open on desktop even in self mode', () => {
    mockUseIsMobile.mockReturnValue(false);
    render(<CompanyForm company={company} mode="self" />);

    expect(within(section('direccion')).getByLabelText('Calle')).toBeVisible();
    expect(within(section('configuracion')).getByLabelText('RFC')).toBeVisible();
  });
});
