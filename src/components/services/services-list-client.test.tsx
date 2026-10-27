import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesListClient } from '@/components/services/services-list-client';
import { getServices } from '@/actions/services';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

// userEvent flows can pass 5 s on a loaded runner (ZIG-I10 QA).
jest.setTimeout(30_000);

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/actions/services', () => ({
  deleteService: jest.fn(),
  getServices: jest.fn(),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;
const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;
const mockUsePermissions = usePermissions as jest.MockedFunction<
  typeof usePermissions
>;

const selectedCompany = {
  id: 1,
  name: 'Acme',
  logo: () => null,
  logoUrl: null,
  plan: 'basic',
  is_system: false,
};

const makeService = (overrides = {}) =>
  ({
    id: 1,
    name: 'Servicio Alfa',
    description: 'Servicio de prueba',
    price: '120.00',
    company_id: 1,
    created_at: new Date('2026-05-01T00:00:00Z'),
    updated_at: new Date('2026-05-01T00:00:00Z'),
    deleted_at: null,
    ...overrides,
  }) as Awaited<ReturnType<typeof getServices>> extends {
    data?: Array<infer T>;
  }
    ? T
    : never;

const arrange = ({
  canWrite = true,
  result = { success: true, data: [] },
}: {
  canWrite?: boolean;
  result?: Awaited<ReturnType<typeof getServices>>;
} = {}) => {
  mockUseCompany.mockReturnValue({
    selectedCompany,
    setSelectedCompany: jest.fn(),
  });
  mockUsePermissions.mockReturnValue({
    isSystem: false,
    permissions: canWrite
      ? ['services.read', 'services.write']
      : ['services.read'],
    loading: false,
    can: (permission?: string) =>
      !permission ||
      (canWrite
        ? ['services.read', 'services.write'].includes(permission)
        : permission === 'services.read'),
  });
  mockGetServices.mockResolvedValue(result);
};

/** From lg (ZIG-I33): DesktopSwitch mounts only the desktop tree. */
const mockViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width: 1024px'),
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

const manyServices = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    makeService({ id: index + 1, name: `Servicio ${String(index + 1).padStart(2, '0')}` }),
  );

describe('ServicesListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockViewport(false);
  });

  it('shows a permission-aware first-use empty state for writers', async () => {
    arrange();

    render(<ServicesListClient />);

    expect(
      screen.getByRole('status', { name: /cargando lista de servicios/i }),
    ).toBeInTheDocument();

    expect(await screen.findByText('Sin servicios')).toBeInTheDocument();
    expect(
      screen.getByText(/Agrega el primer servicio/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Nuevo servicio/i }),
    ).toBeInTheDocument();
  });

  it('does not offer write actions in the empty state for read-only users', async () => {
    arrange({ canWrite: false });

    render(<ServicesListClient />);

    expect(await screen.findByText('Sin servicios')).toBeInTheDocument();
    expect(
      screen.getByText(/No hay servicios registrados/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Nuevo servicio/i }),
    ).not.toBeInTheDocument();
  });

  it('distinguishes filtered empty results and offers to clear filters', async () => {
    const user = userEvent.setup();
    arrange({ result: { success: true, data: [makeService()] } });

    render(<ServicesListClient />);

    expect(await screen.findAllByText('Servicio Alfa')).not.toHaveLength(0);

    await user.type(
      screen.getByRole('textbox', { name: /buscar servicios/i }),
      'inexistente',
    );

    expect(
      await screen.findByText(/No encontramos servicios/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Búsqueda: inexistente')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Limpiar filtros de servicios/i }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /^Limpiar filtros$/i }),
    ).toBeInTheDocument();
  });

  it('shows load errors as recoverable alert states', async () => {
    arrange({
      result: {
        success: false,
        error: 'No se pudieron cargar los servicios',
        errorType: 'server',
      },
    });

    render(<ServicesListClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error del servidor',
    );

    await userEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    await waitFor(() => {
      expect(mockGetServices).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the default materials count on cards and in the table (ZIG-I10-2)', async () => {
    arrange({
      result: {
        success: true,
        data: [
          makeService({
            materials: [
              { id: 1, material_id: 9, name: 'Gas', unit: 'kg', quantity: 1, price: 380, catalog_price: 380 },
              { id: 2, material_id: 10, name: 'Tubo', unit: 'm', quantity: 3, price: 85, catalog_price: 85 },
            ],
          }),
          makeService({ id: 2, name: 'Servicio Beta', materials: [] }),
        ],
      },
    });

    render(<ServicesListClient />);

    const counts = await screen.findAllByTestId('service-card-materials');
    expect(counts).toHaveLength(1);
    expect(counts[0]).toHaveTextContent('2 materiales');
  });

  it('keeps every card on the phone, without a pager or a table (ZIG-I33)', async () => {
    arrange({ result: { success: true, data: manyServices(30) } });

    render(<ServicesListClient />);

    expect(await screen.findByText('Servicio 30')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  describe('from lg (ZIG-I33)', () => {
    beforeEach(() => {
      mockViewport(true);
    });

    it('pages the table by 25 in the browser once the catalog passes 25', async () => {
      const user = userEvent.setup();
      arrange({ result: { success: true, data: manyServices(30) } });

      render(<ServicesListClient />);

      const table = await screen.findByRole('table', { name: 'Servicios' });
      expect(screen.queryByTestId('service-card-materials')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('services-row')).toHaveLength(25);
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1–25 de 30 servicios');
      expect(table.querySelector('thead')).toHaveClass('sticky', 'top-16');

      await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

      expect(screen.getAllByTestId('services-row')).toHaveLength(5);
      expect(screen.getByTestId('list-footer')).toHaveTextContent('26–30 de 30 servicios');
    });

    it('counts a short catalog with its noun, right-aligns Precio and pills the status', async () => {
      arrange({
        result: {
          success: true,
          data: [makeService(), makeService({ id: 2, name: 'Servicio Beta', deleted_at: new Date() })],
        },
      });

      render(<ServicesListClient />);

      await screen.findByRole('table', { name: 'Servicios' });
      expect(screen.getByTestId('list-footer')).toHaveTextContent('2 de 2 servicios');
      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Precio/ })).toHaveClass('text-right');
      expect(screen.getByText('Activo')).toHaveAttribute('data-tone', 'emerald');
      expect(screen.getByText('Eliminado')).toHaveAttribute('data-tone', 'red');
      expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
    });
  });
});
