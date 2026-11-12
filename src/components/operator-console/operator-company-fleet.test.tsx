/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
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

jest.mock('@/actions/company-portability', () => ({
  downloadCompanyExportJson: jest.fn(),
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

const profile = (missing: string[] = []) => ({
  total: 12,
  done: 12 - missing.length,
  missing: missing.length,
  missingLabels: missing,
  groups: [],
});

const FLEET = [
  {
    id: 4,
    name: 'ClimaTotal Demo',
    email: 'demo@climatotal.test',
    phone: '555',
    logo: null,
    is_system: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    lifecycle: 'ACTIVE',
    lifecycleLabel: 'Activa',
    allowsAuthentication: true,
    profile: profile(),
    peopleCount: 3,
    lastSignInAt: new Date().toISOString(),
    alert: null,
    statusSince: null,
    retentionEndsAt: null,
    attention: [],
    needsAttention: false,
    editHref: '/companies/4/edit',
  },
  {
    id: 9,
    name: 'Clima Bajío',
    email: 'admin@bajio.test',
    phone: '477',
    logo: null,
    is_system: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    lifecycle: 'ACTIVE',
    lifecycleLabel: 'Activa',
    allowsAuthentication: true,
    profile: profile(),
    peopleCount: 4,
    lastSignInAt: new Date().toISOString(),
    alert: {
      kind: 'sign_in_burst',
      at: new Date().toISOString(),
      account: 'luis@bajio.test',
      count: 7,
      label: '7 inicios fallidos en 15 min',
    },
    statusSince: null,
    retentionEndsAt: null,
    attention: [
      { id: 'alert', label: 'Alerta de seguridad', detail: '7 inicios fallidos en 15 min', tone: 'red' },
    ],
    needsAttention: true,
    editHref: '/companies/9/edit',
  },
];

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
    mockGetOperatorCompanyFleet.mockResolvedValue({ success: true, data: FLEET });
  });

  it('renders the phone cards with the name as the link (no role=button card)', async () => {
    render(<OperatorCompanyFleet />);

    const link = await screen.findByRole('link', { name: 'ClimaTotal Demo' });
    expect(link).toHaveAttribute('href', '/operator-console/4/resumen');
    expect(screen.queryByRole('button', { name: /Seleccionar contexto/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Nueva empresa/ })[0]).toHaveAttribute(
      'href',
      '/companies/new',
    );
  });

  describe('desktop (ZIG-I38-3)', () => {
    beforeEach(() => {
      mockViewport(true);
    });

    it('shows the title with the count, view tabs and the attention reason', async () => {
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      expect(screen.getByRole('heading', { level: 1, name: /Consola operadora · 2/ })).toBeInTheDocument();
      const views = screen.getByRole('navigation', { name: 'Vistas de la flota' });
      expect(within(views).getByRole('button', { name: /Requieren atención/ })).toHaveTextContent('1 · 1 alerta');

      const rows = within(table).getAllByTestId('operator-fleet-row');
      expect(rows).toHaveLength(2);
      expect(within(table).getByText('Alerta de seguridad')).toHaveAttribute('data-tone', 'red');
      expect(within(table).getByText('Al día')).toBeInTheDocument();
    });

    it('filters with «Requieren atención» and the footer counts the rows', async () => {
      const user = userEvent.setup();
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      await user.click(screen.getByRole('button', { name: /Requieren atención/ }));
      expect(within(table).getAllByTestId('operator-fleet-row')).toHaveLength(1);
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1 de 2 empresas');
    });

    it('opens a company without switching the app company and marks «Tu contexto»', async () => {
      mockUseCompany.mockReturnValue({ selectedCompany: { id: 4 }, setSelectedCompany: mockSetSelectedCompany });
      const user = userEvent.setup();
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      expect(within(table).getByText('Tu contexto')).toBeInTheDocument();
      const abrir = within(table).getByRole('link', { name: 'Abrir ClimaTotal Demo' });
      expect(abrir).toHaveAttribute('href', '/operator-console/4/resumen');
      await user.click(within(table).getByRole('button', { name: 'Acciones de ClimaTotal Demo' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/companies/4/edit'));
      expect(mockSetSelectedCompany).not.toHaveBeenCalled();
    });

    it('«Operar como esta empresa» switches the context and opens its Inicio', async () => {
      const user = userEvent.setup();
      render(<OperatorCompanyFleet />);

      const table = await screen.findByRole('table', { name: 'Flota de empresas' });
      await user.click(within(table).getByRole('button', { name: 'Acciones de ClimaTotal Demo' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Operar como esta empresa' }));
      expect(mockSetSelectedCompany).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
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
