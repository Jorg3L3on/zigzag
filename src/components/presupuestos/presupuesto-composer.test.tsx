/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  PresupuestoComposer,
  PresupuestoEditComposer,
} from '@/components/presupuestos/presupuesto-composer';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';
import { addDays, startOfDay } from 'date-fns';
import {
  buildPresupuestoComposerDraftKey,
  buildTicketComposerDraftKey,
} from '@/lib/ticket-composer-draft';

// userEvent flows can pass 5 s on a loaded runner (ZIG-I10 QA).
jest.setTimeout(30_000);

const mockPush = jest.fn();
const mockCreateTicketWithLines = jest.fn();
const mockCreatePresupuestoWithLines = jest.fn();
const mockUpdatePresupuesto = jest.fn();
const mockRefresh = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/presupuestos/create',
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
      { id: 7, name: 'Mantenimiento', price: '4200.00', description: 'x' },
      { id: 8, name: 'Recarga de gas', price: '350.00', description: 'y' },
    ],
  })),
}));

jest.mock('@/actions/tickets', () => ({
  createTicketWithLines: (...args: unknown[]) => mockCreateTicketWithLines(...args),
}));

jest.mock('@/actions/presupuestos', () => ({
  createPresupuestoWithLines: (...args: unknown[]) =>
    mockCreatePresupuestoWithLines(...args),
  updatePresupuesto: (...args: unknown[]) => mockUpdatePresupuesto(...args),
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

const renderComposer = () =>
  render(
    <MobileChromeProvider>
      <PresupuestoComposer />
    </MobileChromeProvider>,
  );

const saveButtons = () =>
  screen.getAllByRole('button', { name: 'Guardar presupuesto' });

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

describe('PresupuestoComposer (ZIG-I5-3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockCreateTicketWithLines.mockReset();
    mockCreatePresupuestoWithLines.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it('shows the presupuesto copy, Vence and no Captura rápida', () => {
    renderComposer();

    expect(screen.getByRole('heading', { name: 'Nuevo presupuesto' })).toBeTruthy();
    expect(screen.getByText('Vence')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Vence/ })).toHaveTextContent(
      'Sin vencimiento',
    );
    expect(screen.queryByText('Captura rápida')).toBeNull();
    saveButtons().forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByRole('button', { name: /^Crear/ })).toBeNull();
  });

  it('Vence chips set the date from today and can be cleared', async () => {
    const user = userEvent.setup();
    renderComposer();

    const group = screen.getByRole('group', { name: 'Vigencia rápida' });
    await user.click(within(group).getByRole('button', { name: '15 días' }));
    expect(within(group).getByRole('button', { name: '15 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Vence/ })).toHaveTextContent('en 15 días');

    await user.click(screen.getByRole('button', { name: 'Sin vencimiento' }));
    expect(within(group).getByRole('button', { name: '15 días' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('saves the quote with its lines and Vence in one call, then clears its own draft', async () => {
    const user = userEvent.setup();
    mockCreatePresupuestoWithLines.mockResolvedValue({
      success: true,
      data: { id: '400', total: 12600 },
    });
    renderComposer();

    await pickClient(user);
    await addLine(user, 'Mantenimiento · $4,200.00', '3');
    await user.click(screen.getByRole('button', { name: '7 días' }));

    await waitFor(() =>
      expect(
        window.localStorage.getItem(buildPresupuestoComposerDraftKey(10)),
      ).not.toBeNull(),
    );
    // The quote draft never touches the ticket draft.
    expect(window.localStorage.getItem(buildTicketComposerDraftKey(10))).toBeNull();

    const [save] = saveButtons();
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(mockCreatePresupuestoWithLines).toHaveBeenCalledTimes(1));
    expect(mockCreateTicketWithLines).not.toHaveBeenCalled();
    const payload = mockCreatePresupuestoWithLines.mock.calls[0][0];
    expect(payload).toMatchObject({
      company_id: 10,
      client_id: 5,
      lines: [{ service_id: 7, quantity: 3, price: 4200 }],
      client_total: 12600,
    });
    expect(payload.expires_at.getTime()).toBe(
      addDays(startOfDay(new Date()), 7).getTime(),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/presupuestos/400/listo'));
    expect(window.localStorage.getItem(buildPresupuestoComposerDraftKey(10))).toBeNull();
  });

  it('restores Vence from the draft after a reload', async () => {
    const expires = addDays(startOfDay(new Date()), 30);
    window.localStorage.setItem(
      buildPresupuestoComposerDraftKey(10),
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        expires_at: expires.toISOString(),
        lines: [],
      }),
    );
    renderComposer();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });
});

describe('PresupuestoEditComposer (ZIG-I5-5)', () => {
  const edit = {
    id: '1057',
    client: { id: 5, label: 'Cliente Demo · 5550001111' },
    ticketDate: '2026-10-09T12:00:00.000Z',
    expiresAt: null,
    notes: 'Nota previa',
    lines: [
      {
        key: 'line-90',
        kind: 'custom' as const,
        service_id: null,
        service_name: 'Revisión de fuga',
        save_to_catalog: false,
        quantity: 1,
        price: 600,
      },
      {
        key: 'line-91',
        kind: 'catalog' as const,
        service_id: 7,
        service_name: 'Mantenimiento',
        quantity: 2,
        price: 4200,
      },
    ],
  };

  const renderEdit = () =>
    render(
      <MobileChromeProvider>
        <PresupuestoEditComposer edit={edit} />
      </MobileChromeProvider>,
    );

  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockUpdatePresupuesto.mockReset();
    mockCreatePresupuestoWithLines.mockReset();
  });

  it('loads the quote with the client locked and Guardar cambios enabled', async () => {
    renderEdit();

    expect(screen.getByRole('heading', { name: 'Editar presupuesto #1057' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).toBeNull();
    const lines = screen.getByRole('list', { name: 'Servicios del presupuesto' });
    expect(within(lines).getByText('Revisión de fuga')).toBeTruthy();
    expect(within(lines).getByText('Nuevo')).toBeTruthy();
    expect(document.getElementById('composer-notes')).toHaveValue('Nota previa');
    screen
      .getAllByRole('button', { name: 'Guardar cambios' })
      .forEach((button) => expect(button).toBeEnabled());
  });

  it('saves through updatePresupuesto with inline and catalog lines, no draft kept', async () => {
    const user = userEvent.setup();
    mockUpdatePresupuesto.mockResolvedValue({ success: true, data: {} });
    renderEdit();

    await user.click(screen.getByRole('button', { name: '15 días' }));
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0]);

    await waitFor(() => expect(mockUpdatePresupuesto).toHaveBeenCalledTimes(1));
    const [id, data] = mockUpdatePresupuesto.mock.calls[0];
    expect(id).toBe(1057);
    expect(data).toMatchObject({
      company_id: 10,
      work_notes: 'Nota previa',
      services: [
        {
          kind: 'custom',
          name: 'Revisión de fuga',
          save_to_catalog: false,
          quantity: 1,
          price: 600,
        },
        { service_id: 7, quantity: 2, price: 4200 },
      ],
    });
    expect(data.expires_at.getTime()).toBe(addDays(startOfDay(new Date()), 15).getTime());
    expect(mockCreatePresupuestoWithLines).not.toHaveBeenCalled();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/presupuestos/1057'));
    expect(window.localStorage.getItem(buildPresupuestoComposerDraftKey(10))).toBeNull();
  });
});
