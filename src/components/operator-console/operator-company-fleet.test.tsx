/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OperatorCompanyFleet } from '@/components/operator-console/operator-company-fleet';

const mockUseCompany = jest.fn();
const mockSetSelectedCompany = jest.fn();
const mockGetOperatorCompanyFleet = jest.fn();

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
  useRouter: () => ({ push: jest.fn() }),
}));

describe('OperatorCompanyFleet', () => {
  beforeEach(() => {
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
});
