import { render, screen, waitFor } from '@testing-library/react';
import { OperatorLifecyclePanel } from '@/components/operator-console/operator-lifecycle-panel';

const mockUseCompany = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/actions/companies', () => ({
  getCompany: jest.fn(async () => ({
    success: true,
    data: {
      id: 9,
      name: 'Acme Ops',
      phone: '555',
      email: 'ops@acme.test',
      logo: null,
      is_system: false,
      street: 'Main',
      interior_number: null,
      exterior_number: '1',
      neighborhood: 'Centro',
      city: 'CDMX',
      state: 'CDMX',
      country: 'MX',
      postal_code: '01000',
      status: 'ACTIVE',
      settings: { rfc: 'X', default_currency: 'MXN' },
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
    },
  })),
}));

jest.mock('@/actions/company-lifecycle', () => ({
  setCompanyLifecycleStatus: jest.fn(),
}));

jest.mock('@/components/companies/company-portability-panel', () => ({
  CompanyPortabilityPanel: ({ company }: { company: { name: string } }) => (
    <div>Portabilidad: {company.name}</div>
  ),
}));

describe('OperatorLifecyclePanel', () => {
  it('shows target company name in portability section', async () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 9, name: 'Acme Ops', is_system: false },
    });

    render(<OperatorLifecyclePanel />);

    await waitFor(() => {
      expect(screen.getByText('Portabilidad: Acme Ops')).toBeInTheDocument();
    });
  });
});
