/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketComposer } from '@/components/tickets/composer/ticket-composer';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';
import {
  buildTicketComposerDraftKey,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';

const mockPush = jest.fn();
const mockCreateTicketWithLines = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/tickets/create',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 10, name: 'Demo Co' } }),
}));

jest.mock('@/actions/clients', () => ({
  getClients: jest.fn(async () => ({
    success: true,
    data: {
      items: [
        { id: 5, name: 'Cliente Demo', phone: '5550001111' },
        { id: 6, name: 'Otra Persona', phone: null },
      ],
    },
  })),
  getClient: jest.fn(async () => ({ success: false })),
}));

jest.mock('@/actions/services', () => ({
  getServices: jest.fn(async () => ({
    success: true,
    data: [
      { id: 7, name: 'Mantenimiento', price: '4200.00', description: 'x', materials: [] },
      { id: 8, name: 'Recarga de gas', price: '350.00', description: 'y', materials: [] },
      {
        id: 9,
        name: 'Instalación minisplit',
        price: '3500.00',
        description: 'z',
        // ZIG-I10: service defaults prefill the line.
        materials: [
          {
            id: 1,
            material_id: 21,
            name: 'Gas R410A',
            unit: 'kg',
            quantity: 1.5,
            price: 380,
            catalog_price: 380,
          },
          {
            id: 2,
            material_id: 22,
            name: 'Tubo de cobre',
            unit: 'm',
            quantity: 3,
            price: 85,
            catalog_price: 85,
          },
        ],
      },
    ],
  })),
  searchMaterials: jest.fn(async () => ({
    success: true,
    data: [{ id: 23, name: 'Cinta aislante', unit: 'pza', price: 40 }],
  })),
}));

jest.mock('@/actions/tickets', () => ({
  createTicketWithLines: (...args: unknown[]) => mockCreateTicketWithLines(...args),
}));

jest.mock('@/actions/presupuestos', () => ({
  createPresupuestoWithLines: jest.fn(),
}));

jest.mock('@/components/clients/client-form', () => ({
  ClientForm: () => <div>Formulario de cliente</div>,
}));

jest.mock('@/components/companies/company-production-notice', () => ({
  CompanyProductionNotice: () => null,
}));

jest.mock('@/components/tripled', () => {
  const actual = jest.requireActual('@/components/tripled');
  return {
    ...actual,
    TripledPageHeader: () => null,
    TripledMobileAppBar: ({ title }: { title: string }) => <div>{title}</div>,
  };
});

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/vibrate-success', () => ({ vibrateSuccess: jest.fn() }));

// Sheet round-trips (materials, ZIG-I10) are slow in jsdom under a parallel run.
jest.setTimeout(30_000);

const renderComposer = () =>
  render(
    <MobileChromeProvider>
      <TicketComposer />
    </MobileChromeProvider>,
  );

const saveButtons = () => screen.getAllByRole('button', { name: 'Guardar ticket' });

const pickClient = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
  const listbox = await screen.findByRole('listbox', { name: 'Cliente' });
  await user.click(within(listbox).getByText('Cliente Demo'));
};

const addLine = async (
  user: ReturnType<typeof userEvent.setup>,
  serviceLabel: string,
  quantity: string,
) => {
  await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
  const sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
  await user.click(within(sheet).getByRole('combobox', { name: 'Servicio' }));
  const listbox = await screen.findByRole('listbox', { name: 'Servicio' });
  await user.click(within(listbox).getByText(serviceLabel));
  const qty = within(sheet).getByRole('spinbutton', { name: 'Cantidad del servicio' });
  await user.clear(qty);
  await user.type(qty, quantity);
  await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Agregar servicio' })).toBeNull(),
  );
};

describe('TicketComposer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockCreateTicketWithLines.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it('keeps Guardar ticket disabled until a client and a line exist', async () => {
    renderComposer();

    expect(screen.getByRole('heading', { name: 'Nuevo ticket' })).toBeTruthy();
    expect(screen.getAllByText('Elige un cliente').length).toBeGreaterThan(0);
    saveButtons().forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByText(/Paso \d de \d/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Crear/ })).toBeNull();
  });

  it('builds two lines with a running total and saves them in one call', async () => {
    const user = userEvent.setup();
    mockCreateTicketWithLines.mockResolvedValue({
      success: true,
      data: { id: '1201', total: 12950 },
    });
    renderComposer();

    await pickClient(user);
    await addLine(user, 'Mantenimiento · $4,200.00', '3');
    await addLine(user, 'Recarga de gas · $350.00', '1');

    const lines = screen.getByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByText('3 × $4,200.00')).toBeTruthy();
    expect(within(lines).getByText('1 × $350.00')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('composer-total')).toHaveTextContent('$12,950.00'),
    );
    expect(mockCreateTicketWithLines).not.toHaveBeenCalled();

    const [save] = saveButtons();
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalledTimes(1));
    expect(mockCreateTicketWithLines.mock.calls[0][0]).toMatchObject({
      company_id: 10,
      client_id: 5,
      lines: [
        { service_id: 7, quantity: 3, price: 4200 },
        { service_id: 8, quantity: 1, price: 350 },
      ],
      client_total: 12950,
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tickets/1201/listo'));
    expect(
      window.localStorage.getItem(buildTicketComposerDraftKey(10)),
    ).toBeNull();
  });

  it('edits and removes draft lines before saving', async () => {
    const user = userEvent.setup();
    renderComposer();

    await addLine(user, 'Mantenimiento · $4,200.00', '1');
    await user.click(screen.getByRole('button', { name: 'Opciones de Mantenimiento' }));
    await user.click(await screen.findByRole('menuitem', { name: /Editar/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar servicio' });
    await user.click(
      within(sheet).getByRole('button', { name: 'Aumentar cantidad del servicio' }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(screen.getByText('2 × $4,200.00')).toBeTruthy(),
    );

    await user.click(screen.getByRole('button', { name: 'Opciones de Mantenimiento' }));
    await user.click(await screen.findByRole('menuitem', { name: /Quitar/ }));
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Servicios del ticket' })).toBeNull(),
    );
  });

  it('adds an inline line with Nuevo and saves it without the catalog (ZIG-I5)', async () => {
    const user = userEvent.setup();
    mockCreateTicketWithLines.mockResolvedValue({
      success: true,
      data: { id: '1202', total: 850 },
    });
    renderComposer();

    await pickClient(user);
    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
    await user.click(within(sheet).getByRole('radio', { name: /Nuevo/ }));
    // Agregar stays disabled until the inline line has a name.
    expect(within(sheet).getByRole('button', { name: 'Agregar' })).toBeDisabled();
    await user.type(
      within(sheet).getByLabelText('Nombre del servicio'),
      'Cambio de capacitor 35 µF',
    );
    const toggle = within(sheet).getByRole('switch', { name: /Guardar en mi catálogo/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.type(
      within(sheet).getByRole('spinbutton', { name: 'Precio del servicio' }),
      '850',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Agregar servicio' })).toBeNull(),
    );

    const lines = screen.getByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByText('Cambio de capacitor 35 µF')).toBeTruthy();
    expect(within(lines).getByText('Nuevo')).toBeTruthy();
    expect(within(lines).queryByText('→ catálogo')).toBeNull();

    await user.click(saveButtons()[0]);
    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalledTimes(1));
    expect(mockCreateTicketWithLines.mock.calls[0][0].lines).toEqual([
      {
        kind: 'custom',
        name: 'Cambio de capacitor 35 µF',
        description: undefined,
        save_to_catalog: false,
        quantity: 1,
        price: 850,
      },
    ]);
  });

  it('marks an inline line → catálogo and restores it in Editar', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    let sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
    await user.click(within(sheet).getByRole('radio', { name: /Nuevo/ }));
    await user.type(within(sheet).getByLabelText('Nombre del servicio'), 'Instalación');
    await user.type(within(sheet).getByLabelText(/Descripción/), 'Incluye base');
    await user.click(within(sheet).getByRole('switch', { name: /Guardar en mi catálogo/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Agregar servicio' })).toBeNull(),
    );
    expect(screen.getByText('→ catálogo')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Opciones de Instalación' }));
    await user.click(await screen.findByRole('menuitem', { name: /Editar/ }));
    sheet = await screen.findByRole('dialog', { name: 'Editar servicio' });
    expect(within(sheet).getByRole('radio', { name: /Nuevo/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(sheet).getByLabelText('Nombre del servicio')).toHaveValue('Instalación');
    expect(within(sheet).getByLabelText(/Descripción/)).toHaveValue('Incluye base');
    expect(
      within(sheet).getByRole('switch', { name: /Guardar en mi catálogo/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('restores the local draft after a reload', async () => {
    writeTicketComposerDraft(buildTicketComposerDraftKey(10), {
      client_id: 5,
      client_label: 'Cliente Demo · 5550001111',
      lines: [
        {
          key: 'l1',
          service_id: 7,
          service_name: 'Mantenimiento',
          quantity: 3,
          price: 4200,
        },
      ],
    });

    renderComposer();

    expect(
      await screen.findByRole('combobox', { name: 'Cliente' }),
    ).toHaveTextContent('Cliente Demo · 5550001111');
    expect(await screen.findByText('3 × $4,200.00')).toBeTruthy();
    await waitFor(() => saveButtons().forEach((b) => expect(b).toBeEnabled()));
  });

  it('keeps the draft and shows an error when the save fails', async () => {
    const user = userEvent.setup();
    mockCreateTicketWithLines.mockResolvedValue({
      success: false,
      error: 'Cliente no encontrado',
      errorType: 'authorization',
    });
    renderComposer();

    await pickClient(user);
    await addLine(user, 'Mantenimiento · $4,200.00', '1');
    await user.click(saveButtons()[0]);

    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem(buildTicketComposerDraftKey(10)),
    ).not.toBeNull();
    await waitFor(() => saveButtons().forEach((b) => expect(b).toBeEnabled()));
  });

  it('prefills service materials, edits them and saves them under the line (ZIG-I10-3)', async () => {
    const user = userEvent.setup();
    mockCreateTicketWithLines.mockResolvedValue({
      success: true,
      data: { id: '1300', total: 4385 },
    });
    renderComposer();
    await pickClient(user);

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
    await user.click(within(sheet).getByRole('combobox', { name: 'Servicio' }));
    const listbox = await screen.findByRole('listbox', { name: 'Servicio' });
    await user.click(within(listbox).getByText('Instalación minisplit · $3,500.00'));

    const rows = within(sheet).getByTestId('composer-line-material-rows');
    expect(within(rows).getByText('1.5 kg × $380.00')).toBeTruthy();
    expect(within(rows).getByText('3 m × $85.00')).toBeTruthy();
    // 3500 + 570 + 255
    await waitFor(() =>
      expect(within(sheet).getByTestId('composer-line-subtotal')).toHaveTextContent(
        '$4,325.00',
      ),
    );

    // Quitar the tubing, then add an inline material saved to the catalog.
    await user.click(within(rows).getByRole('button', { name: 'Quitar Tubo de cobre' }));
    await user.click(within(sheet).getByRole('button', { name: 'Agregar material' }));
    const step = await screen.findByRole('dialog', { name: 'Agregar material' });
    await user.click(within(step).getByRole('radio', { name: 'Nuevo' }));
    await user.type(within(step).getByLabelText('Nombre del material'), 'Soporte de pared');
    await user.click(within(step).getByRole('button', { name: 'pza' }));
    await user.type(within(step).getByLabelText('Precio / pza'), '320');
    await user.click(within(step).getByRole('switch', { name: /Guardar en mi catálogo/ }));
    await user.click(within(step).getByRole('button', { name: 'Agregar material' }));

    const sheetAgain = await screen.findByRole('dialog', { name: 'Agregar servicio' });
    const rowsAgain = within(sheetAgain).getByTestId('composer-line-material-rows');
    expect(within(rowsAgain).getByText('Soporte de pared')).toBeTruthy();
    expect(within(rowsAgain).getByText('Nuevo')).toBeTruthy();
    expect(within(rowsAgain).getByText('→ catálogo')).toBeTruthy();
    expect(within(sheetAgain).getByTestId('composer-line-breakdown')).toHaveTextContent(
      'Servicio $3,500.00 · Materiales $890.00',
    );
    await user.click(within(sheetAgain).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Agregar servicio' })).toBeNull(),
    );

    const lines = screen.getByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByTestId('composer-line-materials')).toHaveTextContent(
      '2 materiales · $890.00',
    );
    await waitFor(() =>
      expect(screen.getByTestId('composer-total')).toHaveTextContent('$4,390.00'),
    );

    await user.click(saveButtons()[0]);
    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalledTimes(1));
    expect(mockCreateTicketWithLines.mock.calls[0][0].lines).toEqual([
      {
        service_id: 9,
        quantity: 1,
        price: 3500,
        materials: [
          { kind: 'catalog', material_id: 21, quantity: 1.5, price: 380 },
          {
            kind: 'custom',
            name: 'Soporte de pared',
            unit: 'pza',
            save_to_catalog: true,
            quantity: 1,
            price: 320,
          },
        ],
      },
    ]);
  });

  it('adds a catalog material from the autocomplete (Del catálogo)', async () => {
    const user = userEvent.setup();
    renderComposer();
    await pickClient(user);

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    const sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
    await user.click(within(sheet).getByRole('combobox', { name: 'Servicio' }));
    await user.click(
      within(await screen.findByRole('listbox', { name: 'Servicio' })).getByText(
        'Recarga de gas · $350.00',
      ),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Agregar material' }));
    const step = await screen.findByRole('dialog', { name: 'Agregar material' });
    await user.type(within(step).getByRole('combobox', { name: 'Material' }), 'cin');
    await user.click(await within(step).findByRole('option', { name: /Cinta aislante/ }));
    await user.click(within(step).getByRole('button', { name: 'Agregar material' }));

    const rows = within(
      await screen.findByRole('dialog', { name: 'Agregar servicio' }),
    ).getByTestId('composer-line-material-rows');
    expect(within(rows).getByText('1 pza × $40.00')).toBeTruthy();
    expect(within(rows).queryByText('Nuevo')).toBeNull();
  });

  it('restores a draft line with materials after a reload', async () => {
    writeTicketComposerDraft(buildTicketComposerDraftKey(10), {
      client_id: 5,
      client_label: 'Cliente Demo · 5550001111',
      lines: [
        {
          key: 'line-a',
          service_id: 7,
          service_name: 'Mantenimiento',
          quantity: 1,
          price: 4200,
          materials: [
            {
              key: 'mat-a',
              material_id: null,
              name: 'Filtro',
              unit: 'pza',
              quantity: 2,
              price: 150,
              save_to_catalog: false,
            },
          ],
        },
      ],
    });
    renderComposer();

    const lines = await screen.findByRole('list', { name: 'Servicios del ticket' });
    expect(within(lines).getByTestId('composer-line-materials')).toHaveTextContent(
      '1 material · $300.00',
    );
    await waitFor(() =>
      expect(screen.getByTestId('composer-total')).toHaveTextContent('$4,500.00'),
    );
  });
});

