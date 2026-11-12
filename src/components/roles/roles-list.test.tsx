import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RolesList } from '@/components/roles/roles-list';

const mockGetRoles = jest.fn();
const mockUpdateDialog = jest.fn();
const mockDeleteDialog = jest.fn();

jest.mock('@/actions/roles', () => ({
  getRoles: (...args: unknown[]) => mockGetRoles(...args),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ isSystem: true, can: () => true }),
}));

jest.mock('@/hooks/use-operator-tenant-company', () => ({
  useOperatorTenantCompany: () => ({
    tenantCompanyId: null,
    tenantCompanyName: null,
    isTenantScoped: false,
  }),
}));

jest.mock('@/app/(app)/roles/create-role-dialog', () => ({
  CreateRoleDialog: () => <button type="button">Crear rol</button>,
}));

jest.mock('@/app/(app)/roles/update-role-dialog', () => ({
  UpdateRoleDialog: ({ role }: { role: { name: string } }) => {
    mockUpdateDialog(role.name);
    return null;
  },
}));

jest.mock('@/app/(app)/roles/delete-role-dialog', () => ({
  DeleteRoleDialog: ({ role }: { role: { name: string } }) => {
    mockDeleteDialog(role.name);
    return null;
  },
}));

// Full lists with Radix menus are slow when the suite runs in parallel.
jest.setTimeout(15_000);

const setViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width'),
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

const roles = [
  {
    id: 1,
    name: 'Técnico',
    description: 'Campo',
    created_at: new Date(Date.UTC(2026, 2, 8, 18)),
    company: null,
    permissions: [{ permission: { id: 4, name: 'tickets.read' } }],
  },
  {
    id: 2,
    name: 'Admin',
    description: null,
    created_at: new Date(Date.UTC(2026, 2, 9, 18)),
    company: { id: 3, name: 'Acme' },
    permissions: [],
  },
];

const renderList = async () => {
  render(<RolesList />);
  await act(async () => {});
};

describe('RolesList on desktop (ZIG-I33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(true);
    mockGetRoles.mockResolvedValue({ success: true, data: roles });
  });

  it('shows the title with the total, pills, header sort and short dates', async () => {
    await renderList();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Roles · 2');
    expect(screen.getByRole('combobox', { name: 'Filtrar por alcance' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por permisos' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('roles-row');
    expect(rows[0]).toHaveTextContent('Admin');
    expect(within(rows[1]).getByText(/^8 mar/)).toBeInTheDocument();
    expect(within(rows[1]).getByText('tickets.read')).toBeInTheDocument();
  });

  it('opens Editar and Eliminar from the ⋯, and Editar from the row', async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByRole('button', { name: 'Acciones de Técnico' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Editar',
      'Eliminar',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(mockDeleteDialog).toHaveBeenLastCalledWith('Técnico');
    expect(mockUpdateDialog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Campo'));
    expect(mockUpdateDialog).toHaveBeenLastCalledWith('Técnico');
  });
});

describe('RolesList on phones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(false);
    mockGetRoles.mockResolvedValue({ success: true, data: roles });
  });

  it('keeps the cards and the old ⋯, whose items do not open the card', async () => {
    const user = userEvent.setup();
    await renderList();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar rol Técnico' })).toBeInTheDocument();
    expect(screen.getByText('2 de 2 roles')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Abrir menú' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(mockDeleteDialog).toHaveBeenLastCalledWith('Técnico');
    expect(mockUpdateDialog).not.toHaveBeenCalled();
  });
});
