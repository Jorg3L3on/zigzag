import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CobranzaPaginatedData } from '@/actions/cobranza';
import {
  CobranzaDesktop,
  cobranzaOrderParam,
  parseCobranzaOrder,
  parseCobranzaTramo,
} from '@/components/cobranza/cobranza-desktop';
import { formatLastPayment } from '@/components/cobranza/cobranza-columns';
import { toast } from 'sonner';
import { buildCobranzaRows, groupCobranzaRowsByClient, summarizeCobranzaBuckets } from '@/lib/cobranza';

const mockGetCobranzaPaginated = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearch = '';

jest.mock('@/actions/cobranza', () => ({
  getCobranzaPaginated: (...args: unknown[]) => mockGetCobranzaPaginated(...args),
}));
jest.mock('@/actions/tickets', () => ({ applyTicketPayment: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, isSystem: false, loading: false }),
}));
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
// The title is desktop-only (ListDesktopTitle); jsdom has no matchMedia.
jest.mock('@/hooks/use-desktop', () => ({
  ...jest.requireActual('@/hooks/use-desktop'),
  useDesktopViewport: () => true,
}));
jest.mock('@/hooks/use-company-payment-info', () => ({ useCompanyPaymentInfo: () => null }));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 4, name: 'ClimaTotal Demo' } }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/cobranza',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const NOW = new Date('2026-02-01T03:00:00Z');

const rows = buildCobranzaRows(
  [
    {
      id: 16,
      client_id: 12,
      client_name: 'Museo de Arte Contemporáneo',
      client_tel: '9613151559',
      ticket_date: new Date('2026-01-02T18:00:00Z'),
      created_at: new Date('2026-01-02T18:00:00Z'),
      total: 1210,
      paid: 0,
      finished: true,
      company_id: 4,
      document_kind: 'ticket',
      folio_number: 16,
      folio_prefix: 'R',
      services_summary: 'Mantenimiento minisplit',
    },
    {
      id: 36,
      client_id: 12,
      client_name: 'Museo de Arte Contemporáneo',
      client_tel: '9613151559',
      ticket_date: new Date('2026-01-20T18:00:00Z'),
      created_at: new Date('2026-01-20T18:00:00Z'),
      total: 2000,
      paid: 400,
      finished: true,
      company_id: 4,
      document_kind: 'ticket',
      folio_number: 36,
      folio_prefix: 'R',
      last_payment_at: new Date('2026-01-25T18:00:00Z'),
    },
    {
      id: 5,
      client_id: 13,
      client_name: 'Ana',
      client_tel: null,
      ticket_date: new Date('2025-09-01T18:00:00Z'),
      created_at: new Date('2025-09-01T18:00:00Z'),
      total: 5000,
      paid: 0,
      finished: true,
      company_id: 4,
      document_kind: 'ticket',
      folio_number: 5,
      folio_prefix: 'R',
    },
  ],
  NOW,
);

const data = (overrides: Partial<CobranzaPaginatedData> = {}): CobranzaPaginatedData => ({
  rows,
  groups: [],
  total: rows.length,
  totalBalance: 7810,
  ticketCount: rows.length,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  buckets: summarizeCobranzaBuckets(rows),
  inProgress: { count: 9, total: 2958780 },
  collectedThisMonth: { amount: 950988.97, payments: 7, month: '2026-10' },
  queueCount: 12,
  ...overrides,
});

describe('CobranzaDesktop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '';
    mockGetCobranzaPaginated.mockResolvedValue({ success: true, data: data() });
  });

  it('shows the strip with the server sums, folios and the En proceso footnote', async () => {
    render(<CobranzaDesktop canWrite />);

    await screen.findAllByTestId('cobranza-row');
    expect(screen.getByTestId('cobranza-bucket-all-amount')).toHaveTextContent('$7,810.00');
    expect(screen.getByTestId('cobranza-bucket-0-30-amount')).toHaveTextContent('$2,810.00');
    expect(screen.getByTestId('cobranza-bucket-90+-amount')).toHaveTextContent('$5,000.00');
    expect(screen.getByTestId('cobranza-collected-month')).toHaveTextContent('$950,988.97');
    expect(screen.getByTestId('cobranza-collected-month')).toHaveTextContent('7 pagos');
    expect(screen.getByTestId('cobranza-collected-month')).toHaveTextContent(/cobrado en octubre/i);
    expect(screen.getByTestId('cobranza-bucket-all')).toHaveTextContent(
      '3 tickets · 2 clientes · promedio',
    );
    expect(screen.getByTestId('cobranza-bucket-90+')).toHaveTextContent('el más viejo');
    expect(screen.getByTestId('cobranza-footer')).toHaveTextContent('3 de 3 tickets · suman $7,810.00');
    expect(screen.getByRole('tab', { name: /por cobrar/i })).toHaveAttribute('aria-selected', 'true');

    expect(screen.getAllByTestId('cobranza-folio').map((el) => el.textContent)).toEqual([
      'R-0005',
      'R-0016',
      'R-0036',
    ]);
    const partial = screen.getAllByTestId('cobranza-row')[2];
    expect(within(partial).getByTestId('cobranza-days')).toHaveTextContent('11 días');
    expect(within(partial).getByTestId('cobranza-last-payment')).toHaveTextContent(
      /último pago hace \d+ días/,
    );
    expect(screen.getByTestId('cobranza-in-progress')).toHaveTextContent(
      '9 tickets en proceso suman $2,958,780.00 y se cobran al terminarlos · Ver en Tickets',
    );
    expect(screen.getByRole('link', { name: 'Ver en Tickets' })).toHaveAttribute(
      'href',
      '/tickets?status=due&finished=no',
    );
    expect(mockGetCobranzaPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 4, bucket: 'all', groupBy: 'ticket', page: 1 }),
    );
  });

  it('a bucket card filters through the URL', async () => {
    const user = userEvent.setup();
    render(<CobranzaDesktop canWrite />);
    await user.click(await screen.findByRole('tab', { name: /más de 90 días/i }));
    expect(mockReplace).toHaveBeenCalledWith('/cobranza?tramo=90%2B', { scroll: false });
  });

  it('reads the bucket and the client view from the URL', async () => {
    mockSearch = 'tramo=90%2B&ver=clientes';
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], groups: groupCobranzaRowsByClient(rows), total: 2 }),
    });
    render(<CobranzaDesktop canWrite />);

    expect(await screen.findAllByTestId('cobranza-client-row')).toHaveLength(2);
    expect(mockGetCobranzaPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: '90+', groupBy: 'client' }),
    );
    expect(screen.getByRole('button', { name: 'Por cliente' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Por cliente opens a client to its tickets and offers the estado de cuenta', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    mockSearch = 'ver=clientes';
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], groups: groupCobranzaRowsByClient(rows), total: 2 }),
    });
    render(<CobranzaDesktop canWrite />);

    const museo = (await screen.findAllByTestId('cobranza-client-row')).find((row) =>
      row.textContent?.includes('Museo'),
    )!;
    expect(within(museo).getByTestId('cobranza-client-count')).toHaveTextContent('2 tickets');
    expect(within(museo).getByTestId('cobranza-client-balance')).toHaveTextContent('$2,810.00');
    // Cobrar ▾ is always there; the estado de cuenta lives in the ⋯.
    expect(within(museo).getByRole('button', { name: /cobrar un ticket de museo/i })).toBeVisible();
    await user.click(within(museo).getByRole('button', { name: /más acciones de museo/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Estado de cuenta por WhatsApp' }));
    const href = String(open.mock.calls[0][0]);
    const text = decodeURIComponent(href.split('?text=')[1]);
    expect(text).toContain('R-0016');
    expect(text).toContain('R-0036');
    expect(text).toContain('Total pendiente: $2,810');
    open.mockRestore();

    await user.click(within(museo).getByRole('button', { name: /ver los tickets de museo/i }));
    expect(screen.getAllByTestId('cobranza-client-ticket').map((el) => el.textContent)).toEqual([
      expect.stringContaining('R-0016'),
      expect.stringContaining('R-0036'),
    ]);
  });

  it('Por cliente opens and closes a client with Enter and Space on the row', async () => {
    mockSearch = 'ver=clientes';
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], groups: groupCobranzaRowsByClient(rows), total: 2 }),
    });
    render(<CobranzaDesktop canWrite />);

    const museo = (await screen.findAllByTestId('cobranza-client-row')).find((row) =>
      row.textContent?.includes('Museo'),
    )!;
    expect(museo).toHaveAttribute('tabindex', '0');
    museo.focus();
    fireEvent.keyDown(museo, { key: 'Enter' });
    expect(screen.getAllByTestId('cobranza-client-ticket')).toHaveLength(2);
    expect(museo).toHaveAttribute('data-state', 'selected');
    fireEvent.keyDown(museo, { key: ' ' });
    expect(screen.queryAllByTestId('cobranza-client-ticket')).toHaveLength(0);
  });

  it('says so when nothing is owed', async () => {
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], total: 0, totalBalance: 0, buckets: summarizeCobranzaBuckets([]) }),
    });
    render(<CobranzaDesktop canWrite />);
    expect(await screen.findByText('Sin saldos pendientes')).toBeInTheDocument();
  });

  it('titles the page with the whole queue and drops the sort select', async () => {
    render(<CobranzaDesktop canWrite />);
    await screen.findAllByTestId('cobranza-row');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cobranza · 12');
    expect(screen.queryByRole('combobox', { name: 'Ordenar' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Estado de pago' })).toHaveTextContent(
      'Pendientes y parciales',
    );
  });

  it('shows Cobrar on every row and keeps WhatsApp in the ⋯', async () => {
    const user = userEvent.setup();
    render(<CobranzaDesktop canWrite />);
    const [first] = await screen.findAllByTestId('cobranza-row');
    expect(within(first).getByRole('button', { name: 'Cobrar el ticket R-0005' })).toBeVisible();
    expect(within(first).queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument();

    const museo = screen.getAllByTestId('cobranza-row')[1];
    await user.click(within(museo).getByRole('button', { name: 'Más acciones del ticket R-0016' }));
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
    expect(items.slice(0, 3)).toEqual(['Ver ticket', 'Recordar por WhatsApp', 'Cobrar']);
  });

  it('sorts from the headers through ?orden=, on the server', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CobranzaDesktop canWrite />);
    await screen.findAllByTestId('cobranza-row');
    const days = screen.getByRole('columnheader', { name: /días sin pagar/i });
    expect(days).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: /^saldo/i }));
    expect(mockReplace).toHaveBeenCalledWith('/cobranza?orden=balance', { scroll: false });
    unmount();

    mockSearch = 'orden=balance';
    render(<CobranzaDesktop canWrite />);
    await screen.findAllByTestId('cobranza-row');
    expect(mockGetCobranzaPaginated).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'balance', sortDirection: 'desc' }),
    );
    expect(screen.getByRole('columnheader', { name: /^saldo/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.click(screen.getByRole('button', { name: /^saldo/i }));
    expect(mockReplace).toHaveBeenLastCalledWith('/cobranza?orden=balance-asc', { scroll: false });
  });

  it('pages with the numbered pager in the card footer', async () => {
    const user = userEvent.setup();
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ total: 60, ticketCount: 60, totalPages: 3 }),
    });
    render(<CobranzaDesktop canWrite />);
    await screen.findAllByTestId('cobranza-row');
    expect(screen.getByTestId('cobranza-footer')).toHaveTextContent('1–3 de 60 tickets · suman');
    const pager = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(pager).getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(pager).getByRole('button', { name: 'Página 3' }));
    await waitFor(() =>
      expect(mockGetCobranzaPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3, pageSize: 25 }),
      ),
    );
  });

  it('says a failed load in an alert, without a toast', async () => {
    mockGetCobranzaPaginated.mockResolvedValue({ success: false, error: 'Falló la base' });
    render(<CobranzaDesktop canWrite />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('opens the Cobrar dialog from the row', async () => {
    const user = userEvent.setup();
    render(<CobranzaDesktop canWrite />);
    await user.click(await screen.findByRole('button', { name: 'Cobrar el ticket R-0016' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Cobrar ticket R-0016' })).toBeInTheDocument(),
    );
  });
});

describe('cobranza helpers for the table', () => {
  it('reads ?tramo= including a typed 90+', () => {
    expect(parseCobranzaTramo('90+')).toBe('90+');
    expect(parseCobranzaTramo('90 ')).toBe('90+');
    expect(parseCobranzaTramo('0-30')).toBe('0-30');
    expect(parseCobranzaTramo('0-14')).toBe('all');
    expect(parseCobranzaTramo(null)).toBe('all');
  });

  it('reads and writes ?orden= per view', () => {
    expect(parseCobranzaOrder(null, 'ticket')).toEqual({ sort: 'days', direction: 'desc' });
    expect(parseCobranzaOrder('balance', 'ticket')).toEqual({ sort: 'balance', direction: 'desc' });
    expect(parseCobranzaOrder('client', 'ticket')).toEqual({ sort: 'client', direction: 'asc' });
    expect(parseCobranzaOrder('total-asc', 'ticket')).toEqual({ sort: 'total', direction: 'asc' });
    expect(parseCobranzaOrder('folio', 'client')).toEqual({ sort: 'balance', direction: 'desc' });
    expect(parseCobranzaOrder('days-asc', 'client')).toEqual({ sort: 'days', direction: 'asc' });
    expect(parseCobranzaOrder('nope', 'ticket')).toEqual({ sort: 'days', direction: 'desc' });

    expect(cobranzaOrderParam({ sort: 'days', direction: 'desc' }, 'ticket')).toBeNull();
    expect(cobranzaOrderParam({ sort: 'days', direction: 'asc' }, 'ticket')).toBe('days-asc');
    expect(cobranzaOrderParam({ sort: 'balance', direction: 'desc' }, 'ticket')).toBe('balance');
    expect(cobranzaOrderParam({ sort: 'balance', direction: 'desc' }, 'client')).toBeNull();
    expect(cobranzaOrderParam({ sort: 'client', direction: 'desc' }, 'ticket')).toBe('client-desc');
  });

  it('words the last payment: relative for a week, then the date', () => {
    const paid = new Date('2025-08-03T18:00:00Z');
    expect(formatLastPayment(null, null)).toBe('sin ningún pago');
    expect(formatLastPayment(paid, 0)).toBe('último pago hoy');
    expect(formatLastPayment(paid, 1)).toBe('último pago hace 1 día');
    expect(formatLastPayment(paid, 7)).toBe('último pago hace 7 días');
    expect(formatLastPayment(paid, 15)).toBe('último pago 3 ago 2025');
  });
});
