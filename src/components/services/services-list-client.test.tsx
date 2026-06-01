import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesListClient } from '@/components/services/services-list-client';
import { getServices } from '@/actions/services';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

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

describe('ServicesListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
