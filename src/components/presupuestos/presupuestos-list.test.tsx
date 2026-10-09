import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PresupuestosList } from '@/components/presupuestos/presupuestos-list';
import { getPresupuestosList } from '@/actions/presupuestos';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

jest.mock('@/actions/presupuestos', () => ({
  getPresupuestosList: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/pdf-download-button', () => ({
  PDFDownloadButton: () => <button type="button">Descargar PDF</button>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

const mockGetPresupuestosList = getPresupuestosList as jest.MockedFunction<
  typeof getPresupuestosList
>;
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

describe('PresupuestosList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany.mockReturnValue({
      selectedCompany,
      setSelectedCompany: jest.fn(),
    });
    mockUsePermissions.mockReturnValue({
      isSystem: false,
      permissions: ['tickets.read', 'tickets.write'],
      loading: false,
      can: () => true,
      refresh: jest.fn(),
    });
    mockGetPresupuestosList.mockResolvedValue({ success: true, data: [] });
  });

  it('renders without throwing and shows empty state', async () => {
    expect(() => render(<PresupuestosList />)).not.toThrow();
    await waitFor(() => {
      expect(screen.getByText('Sin presupuestos')).toBeInTheDocument();
    });
  });

  it('renders populated rows without throwing', async () => {
    mockGetPresupuestosList.mockResolvedValue({
      success: true,
      data: [
        {
          id: '42',
          clientName: 'Cliente Demo',
          clientTel: '555',
          ticketDate: '2026-01-15T12:00:00.000Z',
          expiresAt: null,
          total: 1500,
          status: 'abierto' as const,
          statusLabel: 'Abierto',
          convertedToTicketId: null,
          canceledAt: null,
        },
      ],
    });

    expect(() => render(<PresupuestosList />)).not.toThrow();
    await waitFor(() => {
      expect(screen.getAllByText('Cliente Demo').length).toBeGreaterThan(0);
    });
  });

  const row = (
    id: string,
    clientName: string,
    status: 'abierto' | 'vencido' | 'convertido' | 'cancelado',
    statusLabel: string,
  ) => ({
    id,
    clientName,
    clientTel: '555',
    ticketDate: '2026-10-09T12:00:00.000Z',
    expiresAt: status === 'vencido' ? '2026-10-01T12:00:00.000Z' : null,
    total: 1000,
    status,
    statusLabel,
    convertedToTicketId: status === 'convertido' ? '99' : null,
    canceledAt: null,
  });

  it('shows Abiertos + Vencidos by default with counts, rows open the detail (ZIG-I5-5)', async () => {
    mockGetPresupuestosList.mockResolvedValue({
      success: true,
      data: [
        row('1', 'Abierto SA', 'abierto', 'Abierto'),
        row('2', 'Vencido SA', 'vencido', 'Vencido'),
        row('3', 'Convertido SA', 'convertido', 'Convertido'),
        row('4', 'Cancelado SA', 'cancelado', 'Cancelado'),
      ],
    });
    render(<PresupuestosList />);

    const chips = await screen.findByRole('group', { name: 'Filtrar por estado' });
    const abiertos = within(chips).getByRole('button', { name: /Abiertos/ });
    expect(abiertos).toHaveAttribute('aria-pressed', 'true');
    expect(abiertos).toHaveTextContent('1');
    expect(within(chips).getByRole('button', { name: /Vencidos/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(chips).getByRole('button', { name: /Convertidos/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const rows = screen.getAllByTestId('presupuesto-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/presupuestos/1');
    expect(screen.queryByText('Convertido SA')).toBeNull();
    // Convertir / Cancelar moved to the detail page.
    expect(screen.queryByRole('button', { name: /Convertir/ })).toBeNull();

    fireEvent.click(within(chips).getByRole('button', { name: /Convertidos/ }));
    expect(screen.getAllByTestId('presupuesto-row')).toHaveLength(3);
    expect(screen.getByText('Convertido SA')).toBeTruthy();
  });

  it('shows an empty state when the filter hides everything', async () => {
    mockGetPresupuestosList.mockResolvedValue({
      success: true,
      data: [row('3', 'Convertido SA', 'convertido', 'Convertido')],
    });
    render(<PresupuestosList />);

    expect(await screen.findByText('Nada en este filtro')).toBeTruthy();
  });
});
