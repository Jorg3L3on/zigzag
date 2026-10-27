import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompaniesList } from '@/components/companies/companies-list';

const mockPush = jest.fn();
const mockSetSelectedCompany = jest.fn();
const mockUseCompany = jest.fn();
const mockUsePermissions = jest.fn();
const mockGetCompanies = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const setViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

jest.mock('@/actions/companies', () => ({
  getCompanies: (...args: unknown[]) => mockGetCompanies(...args),
}));

jest.mock('@/app/(app)/companies/delete-company-dialog', () => ({
  DeleteCompanyDialog: () => null,
}));

const company = {
  id: 7,
  name: 'Acme',
  email: 'ops@acme.test',
  phone: '555',
  street: 'Main',
  exterior_number: '1',
  interior_number: null,
  neighborhood: null,
  city: 'CDMX',
  municipality: null,
  state: 'CDMX',
  postal_code: '01000',
  country: 'MX',
  logo: null,
  status: 'ACTIVE',
  is_system: false,
  deleted_at: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  users: [],
};

describe('CompaniesList row activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(false);
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 1, name: 'Sistema', is_system: true },
      setSelectedCompany: mockSetSelectedCompany,
    });
    mockUsePermissions.mockReturnValue({
      isSystem: true,
      can: () => true,
    });
    mockGetCompanies.mockResolvedValue({
      success: true,
      data: [company],
    });
  });

  it('navigates to edit when rowClickAction is edit', async () => {
    render(<CompaniesList />);

    const rows = await screen.findAllByRole('button', {
      name: 'Editar empresa Acme',
    });
    fireEvent.click(rows[0]);

    expect(mockPush).toHaveBeenCalledWith('/companies/7/edit');
    expect(mockSetSelectedCompany).not.toHaveBeenCalled();
  });

  it('selects company context when rowClickAction is select', async () => {
    render(<CompaniesList rowClickAction="select" />);

    const rows = await screen.findAllByLabelText('Seleccionar contexto Acme');
    fireEvent.click(rows[0]);

    expect(mockSetSelectedCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        name: 'Acme',
        is_system: false,
      }),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('CompaniesList on desktop (ZIG-I33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(true);
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 1, name: 'Sistema', is_system: true },
      setSelectedCompany: mockSetSelectedCompany,
    });
    mockUsePermissions.mockReturnValue({ isSystem: true, can: () => true });
    mockGetCompanies.mockResolvedValue({
      success: true,
      data: [company, { ...company, id: 8, name: 'Beta', status: 'SETUP' }],
    });
  });

  const renderList = async () => {
    render(<CompaniesList />);
    await act(async () => {});
  };

  it('titles the page with the total, the status pill filter and Nueva empresa', async () => {
    await renderList();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Empresas · 2');
    expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toHaveTextContent(
      'Todos los estados',
    );
    expect(screen.getByRole('link', { name: 'Nueva empresa' })).toHaveAttribute(
      'href',
      '/companies/new',
    );
    expect(screen.getByTestId('list-footer')).toHaveTextContent('2 de 2 empresas');
  });

  it('keeps Seleccionar visible and puts Editar and Eliminar (last) in the ⋯', async () => {
    const user = userEvent.setup();
    await renderList();

    const row = screen.getAllByTestId('companies-row').find((r) => r.textContent?.includes('Acme'))!;
    expect(within(row).getByText('Activa')).toHaveAttribute('data-tone', 'emerald');
    expect(within(row).getByRole('button', { name: 'Seleccionar contexto Acme' })).toBeVisible();
    expect(within(row).queryByRole('button', { name: 'Editar Acme' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Eliminar Acme' })).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Seleccionar contexto Acme' }));
    expect(mockSetSelectedCompany).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(mockPush).not.toHaveBeenCalled();

    await user.click(within(row).getByRole('button', { name: 'Acciones de Acme' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Editar',
      'Eliminar',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith('/companies/7/edit');
  });

  it('opens the edit page from the row', async () => {
    await renderList();

    const row = screen.getAllByTestId('companies-row').find((r) => r.textContent?.includes('Beta'))!;
    expect(within(row).getByText('En configuración')).toHaveAttribute('data-tone', 'amber');
    fireEvent.click(within(row).getByText('Beta'));
    expect(mockPush).toHaveBeenCalledWith('/companies/8/edit');
  });
});
