import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CobranzaPaginatedData } from '@/actions/cobranza';
import { CobranzaDesktop, parseCobranzaTramo } from '@/components/cobranza/cobranza-desktop';
import { formatLastPayment } from '@/components/cobranza/cobranza-columns';
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
  page: 1,
  pageSize: 25,
  totalPages: 1,
  buckets: summarizeCobranzaBuckets(rows),
  inProgress: { count: 9, total: 2958780 },
  collectedThisMonth: { amount: 950988.97, payments: 7 },
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
      '/tickets?finished=no',
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
    mockSearch = 'ver=clientes';
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], groups: groupCobranzaRowsByClient(rows), total: 2 }),
    });
    render(<CobranzaDesktop canWrite />);

    const museo = (await screen.findAllByTestId('cobranza-client-row')).find((row) =>
      row.textContent?.includes('Museo'),
    )!;
    expect(within(museo).getByTestId('cobranza-client-count')).toHaveTextContent('2');
    expect(within(museo).getByTestId('cobranza-client-balance')).toHaveTextContent('$2,810.00');
    const statement = within(museo).getByTestId('cobranza-statement');
    const text = decodeURIComponent(statement.getAttribute('href')!.split('?text=')[1]);
    expect(text).toContain('R-0016');
    expect(text).toContain('R-0036');
    expect(text).toContain('Total pendiente: $2,810');

    await user.click(within(museo).getByRole('button', { name: /ver los tickets de museo/i }));
    expect(screen.getAllByTestId('cobranza-client-ticket').map((el) => el.textContent)).toEqual([
      expect.stringContaining('R-0016'),
      expect.stringContaining('R-0036'),
    ]);
  });

  it('says so when nothing is owed', async () => {
    mockGetCobranzaPaginated.mockResolvedValue({
      success: true,
      data: data({ rows: [], total: 0, totalBalance: 0, buckets: summarizeCobranzaBuckets([]) }),
    });
    render(<CobranzaDesktop canWrite />);
    expect(await screen.findByText('No hay saldos pendientes')).toBeInTheDocument();
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

  it('words the last payment', () => {
    expect(formatLastPayment(null)).toBe('sin ningún pago');
    expect(formatLastPayment(0)).toBe('último pago hoy');
    expect(formatLastPayment(1)).toBe('último pago ayer');
    expect(formatLastPayment(15)).toBe('último pago hace 15 días');
  });
});
