/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorCompanyFleet } from '@/components/operator-console/operator-company-fleet';

const mockUseCompany = jest.fn();
const mockSetSelectedCompany = jest.fn();
const mockGetOperatorCompanyFleet = jest.fn();
const mockPush = jest.fn();

/** DesktopSwitch keeps one tree: the desktop one when the lg query matches. */
const mockViewport = (desktop: boolean) => {
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

jest.mock('@/actions/company-operator', () => ({
  getOperatorCompanyFleet: (...args: unknown[]) =>
    mockGetOperatorCompanyFleet(...args),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    isSystem: true,
    can: () => true,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('OperatorCompanyFleet', () => {
  beforeEach(() => {
    mockViewport(false);
    mockGetOperatorCompanyFleet.mockClear();
    mockPush.mockClear();
    mockSetSelectedCompany.mockClear();
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      setSelectedCompany: mockSetSelectedCompany,
    });
    mockGetOperatorCompanyFleet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 4,
          name: 'ClimaTotal Demo',
          email: 'demo@test.com',
          phone: '555',
          logo: null,
          is_system: false,
          lifecycle: 'ACTIVE',
          lifecycleLabel: 'Activa',
          allowsAuthentication: true,
          productionReady: true,
          missingCount: 0,
          missingLabels: [],
          readiness: {
            lifecycle: 'ACTIVE',
            profileReady: true,
            productionReady: true,
            missing: [],
            missingLabels: [],
          },
          lastActivityAt: '2026-08-12T12:00:00.000Z',
          lastIncidentAt: null,
          lastIncidentLabel: null,
          editHref: '/companies/4/edit',
        },
      ],
    });
  });

  it('renders fleet labels and selects a company', async () => {
    render(<OperatorCompanyFleet />);

    await waitFor(() => {
      expect(screen.getAllByText('ClimaTotal Demo').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Flota de empresas')).toBeInTheDocument();
    expect(screen.getAllByText('Lista').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByRole('button', {
        name: /Seleccionar contexto ClimaTotal Demo/i,
      })[0]!,
    );

    expect(mockSetSelectedCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        name: 'ClimaTotal Demo',
        is_system: false,
      }),
    );
  });

  it('sends Nueva empresa to /companies/new on the phone', async () => {
    render(<OperatorCompanyFleet />);

    fireEvent.click(await screen.findByRole('button', { name: /Nueva empresa/ }));
    expect(mockPush).toHaveBeenCalledWith('/companies/new');
  });

  describe('desktop (ZIG-I33-8)', () => {
    beforeEach(() => {
      mockViewport(true);
    });

    it('links Nueva empresa to /companies/new beside an h2 with the count', async () => {
      render(<OperatorCompanyFleet />);

      await screen.findByRole('table', { name: 'Flota de empresas' });
      expect(screen.getByRole('heading', { level: 2, name: /Flota de empresas · 1/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Nueva empresa/ })).toHaveAttribute(
        'href',
        '/companies/new',
      );
    });

    it('shows Seleccionar and a ⋯ menu with Editar, pills and header sort', async () => {
      const user = userEvent.setup();
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      const row = within(table).getByTestId('operator-fleet-row');
      expect(within(row).getByText('Activa')).toHaveAttribute('data-tone', 'emerald');
      expect(within(row).getByText('Lista')).toHaveAttribute('data-tone', 'emerald');
      expect(
        within(table).getByRole('columnheader', { name: /Empresa/ }),
      ).toHaveAttribute('aria-sort', 'ascending');

      await user.click(
        within(row).getByRole('button', { name: 'Acciones de ClimaTotal Demo' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/companies/4/edit'));
      expect(mockSetSelectedCompany).not.toHaveBeenCalled();

      await user.click(
        within(row).getByRole('button', { name: 'Seleccionar contexto ClimaTotal Demo' }),
      );
      expect(mockSetSelectedCompany).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
    });

    it('selects the company from the row and counts the fleet in the footer', async () => {
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      fireEvent.keyDown(within(table).getByTestId('operator-fleet-row'), { key: 'Enter' });
      expect(mockSetSelectedCompany).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1 de 1 empresas');
      expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toHaveTextContent(
        'Todos los estados',
      );
    });

    it('shows the standard error with Reintentar', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockGetOperatorCompanyFleet.mockResolvedValueOnce({ success: false, error: 'Fallo' });
      render(<OperatorCompanyFleet />);

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await screen.findByRole('table', { name: 'Flota de empresas' });
      expect(mockGetOperatorCompanyFleet).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });
  });
});
