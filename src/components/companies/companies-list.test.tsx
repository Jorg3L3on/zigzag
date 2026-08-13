import { fireEvent, render, screen } from '@testing-library/react';
import { CompaniesList } from '@/components/companies/companies-list';

const mockPush = jest.fn();
const mockSetSelectedCompany = jest.fn();
const mockUseCompany = jest.fn();
const mockUsePermissions = jest.fn();
const mockGetCompanies = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
