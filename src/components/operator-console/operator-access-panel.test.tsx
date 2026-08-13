import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OperatorAccessPanel } from '@/components/operator-console/operator-access-panel';

const mockUseCompany = jest.fn();
const mockUsePermissions = jest.fn();
const mockGetUsers = jest.fn();
const mockGetRoles = jest.fn();

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));

jest.mock('@/actions/users', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
}));

jest.mock('@/actions/roles', () => ({
  getRoles: (...args: unknown[]) => mockGetRoles(...args),
}));

jest.mock('@/app/(app)/users/create-user-dialog', () => ({
  CreateUserDialog: () => null,
}));

describe('OperatorAccessPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 42, name: 'Acme', is_system: false },
    });
    mockUsePermissions.mockReturnValue({
      isSystem: true,
      can: () => true,
    });
    mockGetUsers.mockResolvedValue({
      success: true,
      data: [
        {
          id: 10n,
          name: 'Ana López',
          email: 'ana@acme.test',
          company_id: 42,
          role: { name: 'Admin' },
        },
        {
          id: 11n,
          name: 'Other Co',
          email: 'other@test',
          company_id: 99,
          role: { name: 'Tech' },
        },
      ],
    });
    mockGetRoles.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          name: 'Admin',
          description: 'Full access',
          company: { id: 42 },
          permissions: [{ permission: { name: 'users.read' } }],
        },
      ],
    });
  });

  it('does not render the acceso y cuentas actions row', async () => {
    render(<OperatorAccessPanel />);

    await waitFor(() => {
      expect(screen.getByText('Cuentas de la empresa')).toBeInTheDocument();
    });
    expect(screen.queryByText('Acceso y cuentas')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Gestionar usuarios/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Gestionar roles/i }),
    ).not.toBeInTheDocument();
  });

  it('defaults to the users tab and lists company-scoped users', async () => {
    render(<OperatorAccessPanel />);

    expect(
      screen.getByRole('tab', { name: /Usuarios/i }),
    ).toHaveAttribute('aria-selected', 'true');

    const usersPanel = screen.getByRole('tabpanel', {
      name: /Usuarios/i,
    });

    await waitFor(() => {
      expect(usersPanel).toHaveTextContent('Ana López');
    });
    expect(usersPanel).toHaveTextContent('ana@acme.test');
    expect(usersPanel).toHaveTextContent('Admin');
    expect(usersPanel).not.toHaveTextContent('Other Co');
  });

  it('switches to the roles tab', async () => {
    render(<OperatorAccessPanel />);

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Roles/i }));

    expect(
      screen.getByRole('tab', { name: /Roles/i }),
    ).toHaveAttribute('aria-selected', 'true');

    const rolesPanel = screen.getByRole('tabpanel', { name: /Roles/i });
    expect(rolesPanel).toHaveTextContent('Full access');
    expect(rolesPanel).toHaveTextContent('users.read');
  });
});
