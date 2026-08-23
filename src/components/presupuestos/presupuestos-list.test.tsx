import { render, screen, waitFor } from '@testing-library/react';
import { PresupuestosList } from '@/components/presupuestos/presupuestos-list';
import { getPresupuestosList } from '@/actions/presupuestos';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';

jest.mock('@/actions/presupuestos', () => ({
  getPresupuestosList: jest.fn(),
  convertPresupuestoToTicket: jest.fn(),
  cancelPresupuesto: jest.fn(),
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
});
