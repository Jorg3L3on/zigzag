/**
 * @jest-environment jsdom
 *
 * ZIG-I35: the composer with no signal. Catalog from the copy on the phone,
 * Guardar sin conexión queues the whole document with its key, and the same
 * key goes with an online save so a retry never makes a second ticket.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TicketComposer } from '@/components/tickets/composer/ticket-composer';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCreateTicketWithLines = jest.fn();
const mockGetClients = jest.fn();
const mockGetServices = jest.fn();
const mockEnqueue = jest.fn();
const mockGetLocalJob = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
  getClients: (...args: unknown[]) => mockGetClients(...args),
  getClient: jest.fn(async () => ({ success: false })),
}));

jest.mock('@/actions/services', () => ({
  getServices: (...args: unknown[]) => mockGetServices(...args),
  searchMaterials: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/actions/tickets', () => ({
  createTicketWithLines: (...args: unknown[]) => mockCreateTicketWithLines(...args),
  updateTicketLines: jest.fn(),
  finishTicket: jest.fn(),
}));

jest.mock('@/actions/presupuestos', () => ({ createPresupuestoWithLines: jest.fn() }));

jest.mock('@/actions/client-service-schedules', () => ({
  listClientServiceSchedulesForClient: jest.fn(async () => ({ success: true, data: [] })),
  upsertClientServiceSchedule: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));

const CACHED_SERVICES = [
  {
    id: 9,
    name: 'Instalación minisplit',
    price: '3500.00',
    description: 'z',
    materials: [
      { id: 1, material_id: 21, name: 'Gas R410A', unit: 'kg', quantity: 1.5, price: 380, catalog_price: 380 },
    ],
  },
];

jest.mock('@/lib/offline-composer-catalog', () => ({
  filterComposerClients: jest.requireActual('@/lib/offline-composer-catalog').filterComposerClients,
  readComposerServices: jest.fn(async () => CACHED_SERVICES),
  readComposerClients: jest.fn(async () => ({
    clients: [{ id: 5, name: 'Cliente Guardado', phone: '5550001111' }],
    updatedAt: '2026-10-30T10:00:00.000Z',
  })),
  refreshComposerClients: jest.fn(async () => false),
  rememberComposerClients: jest.fn(async () => undefined),
  saveComposerServices: jest.fn(),
}));

jest.mock('@/lib/field-jobs', () => ({
  enqueueComposerDocument: (...args: unknown[]) => mockEnqueue(...args),
  fieldJobStore: {
    getLocalJob: (...args: unknown[]) => mockGetLocalJob(...args),
    findOutboxEntryForLocalJob: jest.fn(async () => null),
    deleteOutboxEntry: jest.fn(),
    putLocalJob: jest.fn(),
  },
}));

jest.mock('@/lib/persistent-storage', () => ({ requestPersistentStorage: jest.fn() }));

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
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));
const mockToast = jest.requireMock('sonner').toast as jest.Mock & {
  success: jest.Mock;
  error: jest.Mock;
};

jest.mock('@/lib/vibrate-success', () => ({ vibrateSuccess: jest.fn() }));

jest.setTimeout(30_000);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
};

const renderComposer = () =>
  render(
    <MobileChromeProvider>
      <TicketComposer />
    </MobileChromeProvider>,
  );

const pickClient = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
  const listbox = await screen.findByRole('listbox', { name: 'Cliente' });
  await user.click(await within(listbox).findByText(name));
};

const addCachedService = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));
  const sheet = await screen.findByRole('dialog', { name: 'Agregar servicio' });
  await user.click(within(sheet).getByRole('combobox', { name: 'Servicio' }));
  const listbox = await screen.findByRole('listbox', { name: 'Servicio' });
  await user.click(within(listbox).getByText(/Instalación minisplit/));
  await user.click(within(sheet).getByRole('button', { name: 'Agregar al ticket' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Agregar servicio' })).toBeNull(),
  );
};

describe('TicketComposer offline (ZIG-I35)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockCreateTicketWithLines.mockReset();
    mockEnqueue.mockReset();
    mockGetLocalJob.mockReset();
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockGetClients.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mockGetServices.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => setOnline(true));

  it('with no signal lists the cached catalog and saves the whole ticket on the phone', async () => {
    setOnline(false);
    mockEnqueue.mockResolvedValue({ job: {}, outboxEntry: {} });
    const user = userEvent.setup();
    renderComposer();

    expect(await screen.findByTestId('composer-offline-notice')).toHaveTextContent(
      /no es factura/,
    );
    expect(screen.queryByRole('button', { name: /Nuevo cliente/ })).toBeNull();
    await pickClient(user, 'Cliente Guardado');
    await addCachedService(user);

    const [save] = screen.getAllByRole('button', { name: /^Guardar( sin conexión)?$/ });
    await user.click(save);

    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1));
    const [, input] = mockEnqueue.mock.calls[0];
    expect(input).toMatchObject({
      companyId: 10,
      clientName: 'Cliente Guardado',
      document: {
        kind: 'ticket',
        client_id: 5,
        lines: [
          expect.objectContaining({
            service_id: 9,
            materials: [expect.objectContaining({ material_id: 21, quantity: 1.5 })],
          }),
        ],
      },
    });
    expect(input.document.client_request_id).toMatch(UUID);
    expect(input.document).not.toHaveProperty('finish');
    expect(mockGetServices).not.toHaveBeenCalled();
    expect(mockCreateTicketWithLines).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith(
      'Ticket guardado sin conexión',
      expect.anything(),
    );
    expect(mockPush).not.toHaveBeenCalled();
    // It stays, empty, for the next job; the notice links to what is pending.
    expect(await screen.findByTestId('composer-offline-saved')).toHaveAttribute(
      'href',
      '/tickets?pendientes=1',
    );
    expect(screen.getAllByText('Elige un cliente').length).toBeGreaterThan(0);
  });

  it('Guardar y terminar offline queues the payment to finish on sync', async () => {
    setOnline(false);
    mockEnqueue.mockResolvedValue({ job: {}, outboxEntry: {} });
    const user = userEvent.setup();
    renderComposer();

    await pickClient(user, 'Cliente Guardado');
    await addCachedService(user);
    await user.click(screen.getByRole('radio', { name: 'Todo' }));
    const [finish] = screen.getAllByRole('button', { name: /^(Terminar sin conexión|Terminar)$/ });
    await user.click(finish);

    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1));
    expect(mockEnqueue.mock.calls[0][1].document.finish).toBe('pagado');
  });

  it('online saves send the same client_request_id on every try of the draft', async () => {
    setOnline(true);
    mockGetClients.mockResolvedValue({
      success: true,
      data: { items: [{ id: 5, name: 'Cliente Demo', phone: null }], totalPages: 1 },
    });
    mockGetServices.mockResolvedValue({ success: true, data: CACHED_SERVICES });
    mockCreateTicketWithLines
      .mockResolvedValueOnce({ success: false, error: 'Falló', errorType: 'server' })
      .mockResolvedValueOnce({ success: true, data: { id: '77', total: 4070, folio: 'R-0042' } });
    const user = userEvent.setup();
    renderComposer();

    await pickClient(user, 'Cliente Demo');
    await addCachedService(user);
    const save = () => screen.getAllByRole('button', { name: /^Guardar( ticket)?$/ })[0];
    await user.click(save());
    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(save()).toBeEnabled());
    await user.click(save());
    await waitFor(() => expect(mockCreateTicketWithLines).toHaveBeenCalledTimes(2));

    const [first, second] = mockCreateTicketWithLines.mock.calls.map(([input]) => input);
    expect(first.client_request_id).toMatch(UUID);
    expect(second.client_request_id).toBe(first.client_request_id);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tickets/77'));
  });

  it('says online but the request dies: it is kept on the phone with the same key', async () => {
    setOnline(true);
    mockGetClients.mockResolvedValue({
      success: true,
      data: { items: [{ id: 5, name: 'Cliente Demo', phone: null }], totalPages: 1 },
    });
    mockGetServices.mockResolvedValue({ success: true, data: CACHED_SERVICES });
    mockCreateTicketWithLines.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockEnqueue.mockResolvedValue({ job: {}, outboxEntry: {} });
    const user = userEvent.setup();
    renderComposer();

    await pickClient(user, 'Cliente Demo');
    await addCachedService(user);
    await user.click(screen.getAllByRole('button', { name: /^Guardar( ticket)?$/ })[0]);

    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1));
    const sent = mockCreateTicketWithLines.mock.calls[0][0].client_request_id;
    expect(mockEnqueue.mock.calls[0][1].document.client_request_id).toBe(sent);
    expect(mockToast.success).toHaveBeenCalledWith('Ticket guardado sin conexión', expect.anything());
  });

  it('Revisar opens a pending document from the phone with its own key', async () => {
    setOnline(false);
    const key = '7b0c7c3e-1f8a-4a51-9c39-2f4f0d6a1b11';
    mockSearchParams = new URLSearchParams({ pendiente: key });
    mockGetLocalJob.mockResolvedValue({
      localJobId: key,
      companyId: 10,
      syncStatus: 'error',
      syncError: 'El cliente o un servicio ya no está disponible.',
      remoteTicketId: null,
      payload: {
        client_name: 'Cliente Guardado',
        client_tel: '5550001111',
        composer: {
          kind: 'ticket',
          client_request_id: key,
          client_id: 5,
          client_label: 'Cliente Guardado · 5550001111',
          ticket_date: '2026-10-29T15:00:00.000Z',
          work_notes: 'Revisar fuga',
          lines: [{ key: 'l1', service_id: 9, service_name: 'Instalación minisplit', quantity: 1, price: 3500 }],
          finish: 'pagado',
        },
      },
    });
    mockEnqueue.mockResolvedValue({ job: {}, outboxEntry: {} });
    const user = userEvent.setup();
    renderComposer();

    expect(await screen.findByDisplayValue('Revisar fuga')).toBeInTheDocument();
    // The queued payment comes back selected.
    expect(screen.getByRole('radio', { name: 'Todo' })).toHaveAttribute('aria-checked', 'true');
    const [save] = screen.getAllByRole('button', { name: /^(Terminar sin conexión|Terminar)$/ });
    await user.click(save);
    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1));
    expect(mockEnqueue.mock.calls[0][1].document).toMatchObject({
      client_request_id: key,
      finish: 'pagado',
    });
  });
});
