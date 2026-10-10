/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServiceForm } from '@/components/services/service-form';

const mockCreateService = jest.fn();
const mockUpdateService = jest.fn();
const mockSearchMaterials = jest.fn();

jest.mock('@/actions/services', () => ({
  createService: (...args: unknown[]) => mockCreateService(...args),
  updateService: (...args: unknown[]) => mockUpdateService(...args),
  searchMaterials: (...args: unknown[]) => mockSearchMaterials(...args),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo Co' } }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const fillAndSubmit = (description: string) => {
  fireEvent.change(screen.getByPlaceholderText('Describe el servicio...'), {
    target: { value: description },
  });
  fireEvent.change(screen.getByPlaceholderText('Ej: Limpieza de oficinas'), {
    target: { value: 'Mantenimiento' },
  });
  fireEvent.change(screen.getByPlaceholderText('0.00'), {
    target: { value: '4200' },
  });
  fireEvent.submit(
    screen.getByPlaceholderText('Describe el servicio...').closest('form')!,
  );
};

describe('ServiceForm description limit', () => {
  beforeEach(() => {
    mockCreateService.mockReset();
    mockCreateService.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Mantenimiento', description: 'x', price: '4200' },
    });
  });

  it('shows the 240 counter and accepts exactly 240 characters', async () => {
    render(<ServiceForm />);
    expect(screen.getByText('0/240')).toBeTruthy();

    fillAndSubmit('a'.repeat(240));

    expect(screen.getByText('240/240')).toBeTruthy();
    await waitFor(() => expect(mockCreateService).toHaveBeenCalledTimes(1));
    expect(mockCreateService.mock.calls[0][0].description).toHaveLength(240);
  });

  it('rejects 241 characters without calling the action', async () => {
    render(<ServiceForm />);

    fillAndSubmit('a'.repeat(241));

    expect(
      await screen.findByText(/La descripción no puede exceder 240 caracteres/),
    ).toBeTruthy();
    expect(screen.getByText('241/240')).toBeTruthy();
    expect(mockCreateService).not.toHaveBeenCalled();
  });
});

describe('ServiceForm Materiales (ZIG-I10-2)', () => {
  beforeEach(() => {
    mockCreateService.mockReset();
    mockUpdateService.mockReset();
    mockSearchMaterials.mockReset();
    mockCreateService.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Instalación', description: 'x', price: '3500' },
    });
    mockUpdateService.mockResolvedValue({
      success: true,
      data: { id: 4, name: 'Carga', description: 'x', price: '900' },
    });
    mockSearchMaterials.mockImplementation(async (query: string) => ({
      success: true,
      data: 'gas r410a'.includes(query.toLowerCase())
        ? [{ id: 9, name: 'Gas R410A', unit: 'kg', price: 380 }]
        : [],
    }));
  });

  const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Agregar material' }));
    return screen.findByRole('dialog', { name: 'Agregar material' });
  };

  it('adds a catalog material and a new one, removes one, and saves them with the service', async () => {
    const user = userEvent.setup();
    render(<ServiceForm />);

    // Catalog pick fills unit and price.
    let sheet = await openSheet(user);
    await user.type(within(sheet).getByRole('combobox', { name: 'Nombre del material' }), 'gas');
    const option = await within(sheet).findByRole('option', { name: /Gas R410A/ });
    await user.click(option);
    expect(within(sheet).getByLabelText('Precio / kg')).toHaveValue('380');
    const qty = within(sheet).getByLabelText('Cantidad');
    await user.clear(qty);
    await user.type(qty, '1.5');
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));

    // A new name, with a unit chip.
    sheet = await openSheet(user);
    await user.type(
      within(sheet).getByRole('combobox', { name: 'Nombre del material' }),
      'Tubo de cobre',
    );
    await user.click(within(sheet).getByRole('button', { name: 'm' }));
    await user.type(within(sheet).getByLabelText('Precio / m'), '85');
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));

    // A third one we then remove.
    sheet = await openSheet(user);
    await user.type(within(sheet).getByRole('combobox', { name: 'Nombre del material' }), 'Cinta');
    await user.type(within(sheet).getByLabelText('Precio'), '40');
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));

    const rows = screen.getByTestId('service-material-rows');
    expect(within(rows).getByText('1.5 kg × $380.00')).toBeTruthy();
    expect(within(rows).getByText('1 m × $85.00')).toBeTruthy();
    await user.click(within(rows).getByRole('button', { name: 'Quitar Cinta' }));
    expect(within(rows).queryByText('Cinta')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Describe el servicio...'), {
      target: { value: 'Incluye base' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ej: Limpieza de oficinas'), {
      target: { value: 'Instalación' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], {
      target: { value: '3500' },
    });
    await user.click(screen.getByRole('button', { name: /Crear servicio/ }));

    await waitFor(() => expect(mockCreateService).toHaveBeenCalledTimes(1));
    expect(mockCreateService.mock.calls[0][0].materials).toEqual([
      { material_id: 9, name: 'Gas R410A', unit: 'kg', quantity: 1.5, price: 380 },
      { material_id: null, name: 'Tubo de cobre', unit: 'm', quantity: 1, price: 85 },
    ]);
  });

  it('loads saved materials on edit and only sends them when they change', async () => {
    const user = userEvent.setup();
    const service = {
      id: 4,
      name: 'Carga de gas',
      description: 'Carga',
      price: 900,
      company_id: 1,
      created_at: new Date(),
      updated_at: null,
      deleted_at: null,
      materials: [
        {
          id: 1,
          material_id: 9,
          name: 'Gas R410A',
          unit: 'kg',
          quantity: 2,
          price: 400,
          catalog_price: 380,
        },
      ],
    };
    render(<ServiceForm service={service} />);

    const rows = screen.getByTestId('service-material-rows');
    expect(within(rows).getByText('2 kg × $400.00')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Actualizar servicio/ }));
    await waitFor(() => expect(mockUpdateService).toHaveBeenCalledTimes(1));
    expect(mockUpdateService.mock.calls[0][0]).not.toHaveProperty('materials');

    // Edit the row: quantity 3.
    await user.click(within(rows).getByRole('button', { name: 'Editar Gas R410A' }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar material' });
    const qty = within(sheet).getByLabelText('Cantidad');
    await user.clear(qty);
    await user.type(qty, '3');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
    await user.click(screen.getByRole('button', { name: /Actualizar servicio/ }));

    await waitFor(() => expect(mockUpdateService).toHaveBeenCalledTimes(2));
    expect(mockUpdateService.mock.calls[1][0].materials).toEqual([
      { material_id: 9, name: 'Gas R410A', unit: 'kg', quantity: 3, price: 400 },
    ]);
  });
});

