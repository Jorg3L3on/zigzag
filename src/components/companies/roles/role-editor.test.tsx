import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoleEditor } from '@/components/companies/roles/role-editor';
import { saveCompanyRole, type CompanyRoleSummary } from '@/actions/company-roles';

jest.mock('@/actions/company-roles', () => ({
  saveCompanyRole: jest.fn(),
  deleteCompanyRole: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockSave = saveCompanyRole as jest.MockedFunction<typeof saveCompanyRole>;

const operator: CompanyRoleSummary = {
  id: 7,
  name: 'Operator',
  description: 'Técnico',
  isGlobal: false,
  isProtected: false,
  userCount: 1,
  permissionKeys: [
    'clients.read',
    'clients.write',
    'permissions.read',
    'services.read',
    'services.write',
    'tickets.read',
    'tickets.write',
  ],
};

const renderEditor = (role: CompanyRoleSummary | null = operator, canWrite = true) =>
  render(
    <RoleEditor
      role={role}
      canWrite={canWrite}
      variant="panel"
      onSaved={jest.fn()}
      onDeleted={jest.fn()}
      onCancel={jest.fn()}
      onDuplicate={jest.fn()}
    />,
  );

describe('RoleEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue({ success: true, data: { id: 7 } });
  });

  it('shows the role as uniquely labelled Ver / Editar checkboxes', () => {
    renderEditor();

    expect(screen.getByRole('checkbox', { name: 'Ver Tickets' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Editar Servicios' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ver Equipo' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Administrar Mi empresa' }),
    ).not.toBeChecked();
  });

  it('unticking Servicios / Editar saves the keys and keeps the others', async () => {
    renderEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Editar Servicios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave).toHaveBeenCalledWith({
      id: 7,
      name: 'Operator',
      description: 'Técnico',
      permissionKeys: [
        'clients.read',
        'clients.write',
        'permissions.read',
        'services.read',
        'tickets.read',
        'tickets.write',
      ],
    });
  });

  it('ticking Editar ticks Ver', () => {
    renderEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Editar Equipo' }));

    expect(screen.getByRole('checkbox', { name: 'Ver Equipo' })).toBeChecked();
  });

  it('disables Eliminar rol while someone holds the role', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: /Eliminar rol/ })).toBeDisabled();
    expect(screen.getByText('1 usuario con este rol')).toBeInTheDocument();
    expect(
      screen.getByText('Se habilita cuando nadie tiene este rol.'),
    ).toBeInTheDocument();
  });

  it('asks before a template replaces an edited matrix', async () => {
    renderEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver Roles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Solo lectura' }));

    expect(await screen.findByText('¿Reemplazar los permisos?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar plantilla' }));

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Editar Tickets' })).not.toBeChecked(),
    );
    expect(screen.getByRole('checkbox', { name: 'Ver Tickets' })).toBeChecked();
  });

  it('creates a new role from a template', async () => {
    renderEditor(null);

    fireEvent.change(screen.getByLabelText('Nombre del rol'), {
      target: { value: 'Técnico de campo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Técnico' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear rol' }));

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        id: undefined,
        name: 'Técnico de campo',
        description: '',
        permissionKeys: [
          'clients.read',
          'clients.write',
          'services.read',
          'tickets.read',
          'tickets.write',
        ],
      }),
    );
  });

  it('requires a name', async () => {
    renderEditor(null);

    fireEvent.click(screen.getByRole('button', { name: 'Crear rol' }));

    expect(await screen.findByText('El nombre es requerido')).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows shared roles read-only with Duplicar', () => {
    renderEditor({ ...operator, isGlobal: true });

    expect(screen.getByRole('checkbox', { name: 'Ver Tickets' })).toBeDisabled();
    expect(screen.getByLabelText('Nombre del rol')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duplicar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar rol' })).toBeNull();
  });
});
