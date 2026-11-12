import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PermissionsList } from '@/components/permissions/permissions-list';

const mockGetPermissions = jest.fn();
const mockUpdateDialog = jest.fn();

jest.mock('@/actions/permissions', () => ({
  getPermissions: (...args: unknown[]) => mockGetPermissions(...args),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ isSystem: true, can: () => true }),
}));

jest.mock('@/app/(app)/permissions/create-permission-dialog', () => ({
  CreatePermissionDialog: () => <button type="button">Crear permiso</button>,
}));

jest.mock('@/app/(app)/permissions/update-permission-dialog', () => ({
  UpdatePermissionDialog: ({ permission }: { permission: { name: string } }) => {
    mockUpdateDialog(permission.name);
    return null;
  },
}));

jest.mock('@/app/(app)/permissions/delete-permission-dialog', () => ({
  DeletePermissionDialog: () => null,
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

const permissions = Array.from({ length: 27 }, (_, index) => ({
  id: index + 1,
  name: `clave.${String(index + 1).padStart(2, '0')}`,
  description: `Permiso ${index + 1}`,
  created_at: new Date(Date.UTC(2026, 0, 5, 18)),
  company: null,
}));

describe('PermissionsList on desktop (ZIG-I33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(true);
    mockGetPermissions.mockResolvedValue({ success: true, data: permissions });
  });

  it('titles the page, pages at 25 and opens Editar from the ⋯ and the row', async () => {
    const user = userEvent.setup();
    render(<PermissionsList />);
    await act(async () => {});

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Permisos · 27');
    expect(screen.getByRole('combobox', { name: 'Filtrar por alcance' })).toHaveTextContent(
      'Todas las empresas',
    );
    expect(screen.getAllByTestId('permissions-row')).toHaveLength(25);
    expect(screen.getByTestId('list-footer')).toHaveTextContent('1–25 de 27 permisos');

    await user.click(screen.getByRole('button', { name: 'Acciones de clave.01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(mockUpdateDialog).toHaveBeenLastCalledWith('clave.01');

    fireEvent.click(screen.getByText('Permiso 2'));
    expect(mockUpdateDialog).toHaveBeenLastCalledWith('clave.02');
  });
});

describe('PermissionsList on phones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(false);
    mockGetPermissions.mockResolvedValue({ success: true, data: permissions });
  });

  it('lists every permission as a card', async () => {
    render(<PermissionsList />);
    await act(async () => {});

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Editar permiso/ })).toHaveLength(27);
    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(27);
  });
});
