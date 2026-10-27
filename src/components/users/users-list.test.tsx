import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UsersList } from '@/components/users/users-list';

const mockGetUsers = jest.fn();
const mockUpdateDialog = jest.fn();

jest.mock('@/actions/users', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  resetUserTemporaryPassword: jest.fn(),
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

jest.mock('@/app/(app)/users/create-user-dialog', () => ({
  CreateUserDialog: () => <button type="button">Crear usuario</button>,
}));

jest.mock('@/app/(app)/users/update-user-dialog', () => ({
  UpdateUserDialog: ({ user }: { user: { name: string } }) => {
    mockUpdateDialog(user.name);
    return <div role="dialog" aria-label={`Editar ${user.name}`} />;
  },
}));

jest.mock('@/app/(app)/users/delete-user-dialog', () => ({
  DeleteUserDialog: ({ user }: { user: { name: string } }) => (
    <div role="dialog" aria-label={`Eliminar ${user.name}`} />
  ),
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

const makeUser = (id: number, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  email: `${name.toLowerCase()}@zigzag.test`,
  company_id: 3,
  company: { id: 3, name: 'Acme' },
  role: { id: 1, name: 'Admin' },
  email_verified_at: new Date('2026-02-01'),
  // Noon in the company's calendar, so the short date never shifts a day.
  created_at: new Date(Date.UTC(2026, 0, id, 18)),
  ...overrides,
});

const renderList = async () => {
  render(<UsersList />);
  await act(async () => {});
};

describe('UsersList on desktop (ZIG-I33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(true);
    mockGetUsers.mockResolvedValue({
      success: true,
      data: [
        makeUser(1, 'Beto'),
        makeUser(2, 'Ana', { email_verified_at: null, company_id: null, company: null }),
      ],
    });
  });

  it('titles the page with the total, filters as pills and the create button', async () => {
    await renderList();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Usuarios · 2');
    expect(screen.getByRole('combobox', { name: 'Filtrar por verificación del correo' })).toHaveTextContent(
      'Todos los correos',
    );
    expect(screen.getByRole('combobox', { name: 'Filtrar por empresa' })).toHaveTextContent(
      'Empresa: todas',
    );
    expect(screen.getAllByRole('button', { name: 'Crear usuario' })).toHaveLength(1);
    expect(screen.getByTestId('list-footer')).toHaveTextContent('2 de 2 usuarios');
  });

  it('draws the verified state as a pill and the date short', async () => {
    await renderList();

    const rows = screen.getAllByTestId('users-row');
    const beto = rows.find((row) => row.textContent?.includes('Beto'))!;
    const ana = rows.find((row) => row.textContent?.includes('Ana'))!;
    expect(within(beto).getByText('Sí')).toHaveAttribute('data-tone', 'emerald');
    expect(within(ana).getByText('No')).toHaveAttribute('data-tone', 'slate');
    expect(within(beto).getByText(/^1 ene/)).toBeInTheDocument();
  });

  it('sorts by clicking a header and puts aria-sort on the th', async () => {
    await renderList();

    const nameHeader = screen.getByRole('columnheader', { name: /Nombre/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    // Default: Alta, newest first.
    expect(screen.getByRole('columnheader', { name: /Alta/ })).toHaveAttribute('aria-sort', 'descending');

    await act(async () => {
      fireEvent.click(within(nameHeader).getByRole('button', { name: /Nombre/ }));
    });

    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    const names = screen.getAllByTestId('users-row').map((row) => row.textContent);
    expect(names[0]).toContain('Ana');
    expect(names[1]).toContain('Beto');
  });

  it('opens Editar from the ⋯ and from the row', async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByRole('button', { name: 'Acciones de Beto' }));
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Editar', 'Dar contraseña temporal', 'Eliminar']);
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(mockUpdateDialog).toHaveBeenLastCalledWith('Beto');

    mockUpdateDialog.mockClear();
    const anaRow = screen.getAllByTestId('users-row').find((row) => row.textContent?.includes('Ana'));
    fireEvent.click(within(anaRow!).getByText('ana@zigzag.test'));
    expect(mockUpdateDialog).toHaveBeenLastCalledWith('Ana');
  });

  it('pages at 25 in the client', async () => {
    mockGetUsers.mockResolvedValue({
      success: true,
      data: Array.from({ length: 30 }, (_, index) => makeUser(index + 1, `Persona ${index + 1}`)),
    });
    await renderList();

    expect(screen.getAllByTestId('users-row')).toHaveLength(25);
    expect(screen.getByTestId('list-footer')).toHaveTextContent('1–25 de 30 usuarios');
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getAllByTestId('users-row')).toHaveLength(5);
    expect(screen.getByTestId('list-footer')).toHaveTextContent('26–30 de 30 usuarios');
  });

  it('Limpiar filtros clears the search but keeps the sort', async () => {
    jest.useFakeTimers();
    try {
      await renderList();
      fireEvent.click(
        within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button'),
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'Buscar usuarios' }), {
        target: { value: 'zzz' },
      });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByText('Sin resultados')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: /Limpiar filtros/ })[0]);
      });
      expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('UsersList on phones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(false);
  });

  it('keeps the cards with every user and the old ⋯', async () => {
    mockGetUsers.mockResolvedValue({
      success: true,
      data: Array.from({ length: 30 }, (_, index) => makeUser(index + 1, `Persona ${index + 1}`)),
    });
    await renderList();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Editar usuario/ })).toHaveLength(30);
    expect(screen.getAllByRole('button', { name: 'Abrir menú' })).toHaveLength(30);
    expect(screen.getByText('30 de 30 usuarios')).toBeInTheDocument();
  });
});
