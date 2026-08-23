import { render, screen } from '@testing-library/react';
import CreatePresupuestoPage from '@/app/(app)/presupuestos/create/page';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useCompany } from '@/contexts/company-context';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/actions/clients', () => ({
  getClients: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
}));

jest.mock('@/actions/presupuestos', () => ({
  createPresupuesto: jest.fn(),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;

describe('CreatePresupuestoPage', () => {
  beforeEach(() => {
    mockUseCompany.mockReturnValue({
      selectedCompany: {
        id: 1,
        name: 'Acme',
        logo: () => null,
        logoUrl: null,
        plan: 'basic',
        is_system: false,
      },
      setSelectedCompany: jest.fn(),
    });
  });

  it('renders without throwing when optional client select is empty', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SidebarProvider>
          <CreatePresupuestoPage />
        </SidebarProvider>,
      ),
    ).not.toThrow();
    expect(screen.getByText('Nuevo presupuesto')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
