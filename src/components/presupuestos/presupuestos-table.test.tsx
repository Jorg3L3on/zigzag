/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  convertPresupuestoToTicket,
  getPresupuestosPaginated,
  type PresupuestoTableItem,
} from '@/actions/presupuestos';
import { PresupuestosTable } from '@/components/presupuestos/presupuestos-table';

// userEvent flows can pass 5 s on a loaded runner (ZIG-I10 QA).
jest.setTimeout(30_000);

const push = jest.fn();
const replace = jest.fn();
let search = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/presupuestos',
  useSearchParams: () => new URLSearchParams(search),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/actions/presupuestos', () => ({
  getPresupuestosPaginated: jest.fn(),
  convertPresupuestoToTicket: jest.fn(),
  cancelPresupuesto: jest.fn(),
  duplicatePresupuesto: jest.fn(),
  extendPresupuestoVigencia: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));

const item = (patch: Partial<PresupuestoTableItem>): PresupuestoTableItem => ({
  id: '1',
  folio: 'P-0001',
  clientName: 'Cliente',
  clientTel: '9981000002',
  ticketDate: '2026-10-10T20:21:35.000Z',
  expiresAt: null,
  total: 1000,
  status: 'abierto',
  statusLabel: 'Abierto',
  convertedToTicketId: null,
  canceledAt: null,
  servicesSummary: 'Diagnóstico técnico',
  servicesHead: ['Diagnóstico técnico'],
  servicesCount: 1,
  convertedTicketFolio: null,
  ...patch,
});

const rows = [
  item({
    id: '1117',
    folio: 'P-0004',
    clientName: 'Residencial Las Palmas',
    expiresAt: '2026-10-25T06:00:00.000Z',
    total: 5120,
    servicesSummary: 'Instalación mini-split, Diagnóstico técnico, Limpieza de ductos',
    servicesHead: ['Instalación mini-split', 'Diagnóstico técnico'],
    servicesCount: 3,
  }),
  item({
    id: '1112',
    folio: 'P-0003',
    clientName: 'Ahorita',
    servicesSummary: null,
    servicesHead: [],
    servicesCount: 0,
    total: 0,
  }),
  item({
    id: '1066',
    folio: 'P-0001',
    clientName: 'Test Cliente',
    status: 'vencido',
    statusLabel: 'Vencido',
    expiresAt: '2026-10-20T06:00:00.000Z',
  }),
];

const counts = { all: 6, abierto: 4, vencido: 0, convertido: 1, cancelado: 1, venceHoy: 1 };

/** The desktop tree (ListDesktopTitle) shows from lg. */
const mockDesktopViewport = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

const renderTable = () =>
  render(
    <PresupuestosTable companyId={4} companyName="ClimaTotal Demo" canWrite canInvoice enabled />,
  );

describe('PresupuestosTable (ZIG-I29-3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDesktopViewport();
    search = '';
    jest.useFakeTimers({
      now: new Date('2026-10-25T18:00:00.000Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
    (getPresupuestosPaginated as jest.Mock).mockResolvedValue({
      success: true,
      data: { items: rows, total: 3, page: 1, pageSize: 25, totalPages: 1, counts },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Abiertos + Vencidos by default with the server counts and no amounts', async () => {
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    expect(getPresupuestosPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 4,
        view: 'pendientes',
        sort: { column: 'vence', direction: 'asc' },
        page: 1,
        pageSize: 25,
      }),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Presupuestos · 6');
    const tabs = screen.getByRole('navigation', { name: 'Vistas de presupuestos' });
    const pressed = within(tabs)
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.textContent);
    expect(pressed).toEqual(['Abiertos4 · 1 vence hoy', 'Vencidos0']);
    expect(within(tabs).getByRole('button', { name: /Todos/ })).toHaveTextContent('Todos6 presupuestos');
    expect(tabs.textContent).not.toContain('$');
    // One page reads «3 de 3 presupuestos», inside the table card; the order is the header's arrow.
    expect(screen.getByTestId('list-footer')).toHaveTextContent('3 de 3 presupuestos');
    expect(screen.getByRole('columnheader', { name: /Vence/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.queryByRole('combobox', { name: /ordenar/i })).toBeNull();
  });

  it('sorts on the server from the header and writes ?orden= (ZIG-I33-2)', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(replace).toHaveBeenCalledWith('/presupuestos?orden=total-desc', { scroll: false });
    expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveClass('text-right');
  });

  it('reads the old ?orden= of the sort select as the same order', async () => {
    search = 'orden=recientes';
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    expect(getPresupuestosPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ sort: { column: 'emitido', direction: 'desc' } }),
    );
    expect(screen.getByRole('columnheader', { name: /Emitido/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('paints Aceptado green on desktop and offers its ticket from ⋯', async () => {
    const user = userEvent.setup();
    (getPresupuestosPaginated as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        items: [
          item({
            id: '1200',
            folio: 'P-0009',
            clientName: 'Aceptado SA',
            status: 'convertido',
            statusLabel: 'Aceptado',
            convertedToTicketId: '1130',
            convertedTicketFolio: 'R-0062',
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        counts,
      },
    });
    renderTable();
    await screen.findByText('Aceptado SA');

    const pill = screen.getByTestId('presupuesto-status');
    expect(pill).toHaveTextContent('Aceptado');
    expect(pill.parentElement).toHaveAttribute('data-tone', 'emerald');
    await user.click(screen.getByRole('button', { name: 'Más acciones de P-0009' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Ver ticket R-0062' }));
    expect(push).toHaveBeenCalledWith('/tickets/1130');
    expect(screen.queryByRole('menuitem', { name: 'Cancelar presupuesto' })).toBeNull();
  });

  it('puts the view in the URL', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    await user.click(screen.getByRole('button', { name: /Aceptados/ }));
    expect(replace).toHaveBeenCalledWith('/presupuestos?estado=aceptados', { scroll: false });
  });

  it('tones Vence by how close it is and names the work', async () => {
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    const [today, none, expired] = screen.getAllByTestId('presupuesto-vence');
    expect(today).toHaveAttribute('data-tone', 'soon');
    // Canvas: how far on top, the date and the validity length under it.
    expect(today).toHaveTextContent('Vence hoy25 oct · vigencia de 15 días');
    expect(none).toHaveTextContent('Sin vencimiento');
    expect(expired).toHaveAttribute('data-tone', 'expired');
    expect(expired).toHaveTextContent('Venció hace 5 días');
    expect(screen.getByText('Instalación mini-split, Diagnóstico técnico')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('Sin conceptos todavía')).toBeTruthy();
  });

  it('converts from the row behind the confirmation and lands on the ticket', async () => {
    const user = userEvent.setup();
    (convertPresupuestoToTicket as jest.Mock).mockResolvedValue({
      success: true,
      data: { ticketId: '1130', ticketFolio: 'R-0062', presupuesto: {} },
    });
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    await user.click(screen.getByRole('button', { name: 'Más acciones de P-0004' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Convertir a ticket' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Convertir el presupuesto P-0004 en ticket?');
    await user.click(within(dialog).getByRole('button', { name: 'Convertir a ticket' }));

    await waitFor(() => expect(convertPresupuestoToTicket).toHaveBeenCalledWith(1117, 4));
    expect(push).toHaveBeenCalledWith('/tickets/1130');
  });

  it('offers Editar instead of Convertir on a presupuesto without conceptos, and a WhatsApp reminder', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    renderTable();
    await screen.findByText('Ahorita');

    await user.click(screen.getByRole('button', { name: 'Más acciones de P-0003' }));
    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Convertir a ticket' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(push).toHaveBeenCalledWith('/presupuestos/1112/edit');

    await user.click(screen.getByRole('button', { name: 'Más acciones de P-0004' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Recordar por WhatsApp' }));
    expect(open).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer');
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain(
      'Te recordamos el presupuesto P-0004',
    );
    open.mockRestore();
  });

  it('shows no actions on hover: only ⋯, with the destructive one last (85563215)', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    expect(screen.queryByTestId('presupuesto-row-quick-actions')).toBeNull();
    const row = screen.getAllByTestId('presupuesto-table-row')[0];
    expect(within(row).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Más acciones de P-0004',
    ]);
    expect(within(row).queryByRole('link')).toBeNull();

    await user.click(within(row).getByRole('button', { name: 'Más acciones de P-0004' }));
    const items = (await screen.findAllByRole('menuitem')).map((entry) => entry.textContent);
    expect(items).toEqual([
      'Convertir a ticket',
      'Editar',
      'Recordar por WhatsApp',
      'Descargar PDF',
      'Duplicar',
      'Extender vigencia',
      'Cancelar presupuesto',
    ]);
  });

  it('reaches ⋮ with the keyboard and opens a row with Enter', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    const more = screen.getByRole('button', { name: 'Más acciones de P-0004' });
    more.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Extender vigencia' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar presupuesto' })).toBeTruthy();
    await user.keyboard('{Escape}');

    const row = screen.getAllByTestId('presupuesto-table-row')[0];
    row.focus();
    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/presupuestos/1117');
  });

  it('sizes columns by the page width, so the sidebar cannot squeeze Cliente to nothing', async () => {
    renderTable();
    await screen.findByText('Residencial Las Palmas');

    const table = screen.getByRole('table', { name: 'Presupuestos' });
    // The table card (ListTableCard) is the container.
    expect(table.parentElement).toHaveClass('@container', 'rounded-xl');
    // Client names win: Trabajo only once Cliente keeps 21rem.
    expect(screen.getByRole('columnheader', { name: 'Trabajo' })).toHaveClass('hidden', '@min-[75rem]:table-cell');
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).toHaveClass('@min-[75rem]:w-[21rem]');
    expect(screen.getByRole('columnheader', { name: 'Emitido' })).toHaveClass('hidden', '@min-[48rem]:table-cell');
    // Only ⋯ takes room (ZIG-I33 §5).
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toHaveClass('w-12');
  });
});
