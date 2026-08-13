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
  CreateUserDialog: ({
    defaultCompanyId,
  }: {
    defaultCompanyId?: number;
  }) => (
    <button type="button">Crear usuario ({defaultCompanyId})</button>
  ),
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

  it('renders management CTAs and create user for system writers', async () => {
    render(<OperatorAccessPanel />);

    await waitFor(() => {
      expect(screen.getByText('Cuentas de la empresa')).toBeInTheDocument();
    });

    const usersLink = screen.getByRole('link', { name: /Gestionar usuarios/i });
    const rolesLink = screen.getByRole('link', { name: /Gestionar roles/i });
    expect(usersLink).toHaveAttribute('href', '/users?tenant_company_id=42');
    expect(rolesLink).toHaveAttribute('href', '/roles?tenant_company_id=42');
    expect(
      screen.getByRole('button', { name: /Crear usuario \(42\)/i }),
    ).toBeInTheDocument();
  });

  it('loads users and roles scoped by companyId on the server', async () => {
    render(<OperatorAccessPanel />);

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledWith({ companyId: 42 });
      expect(mockGetRoles).toHaveBeenCalledWith({ companyId: 42 });
    });

    const usersPanel = screen.getByRole('tabpanel', { name: /Usuarios/i });
    expect(usersPanel).toHaveTextContent('Ana López');
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
