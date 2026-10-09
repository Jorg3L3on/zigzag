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
      { id: 7, name: 'Mantenimiento', price: '4200.00', description: 'x' },
      { id: 8, name: 'Recarga de gas', price: '350.00', description: 'y' },
    ],
  })),
}));

jest.mock('@/actions/tickets', () => ({
  createTicketWithLines: (...args: unknown[]) => mockCreateTicketWithLines(...args),
}));

jest.mock('@/components/clients/client-form', () => ({
  ClientForm: () => <div>Formulario de cliente</div>,
}));

jest.mock('@/components/services/service-form', () => ({
  ServiceForm: () => <div>Formulario de servicio</div>,
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
      <TicketComposer />
    </MobileChromeProvider>,
  );

const saveButtons = () => screen.getAllByRole('button', { name: 'Guardar ticket' });

const pickClient = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
  const listbox = await screen.findByRole('listbox', { name: 'Cliente' });
  await user.click(within(listbox).getByText('Cliente Demo · 5550001111'));
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
});
