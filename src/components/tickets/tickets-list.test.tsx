import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TicketsList from '@/components/tickets/tickets-list';
import { getTicketsPaginated } from '@/actions/tickets';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from '@/lib/offline-snapshot';

// userEvent flows can pass 5 s on a loaded runner (ZIG-I10 QA).
jest.setTimeout(30_000);

jest.mock('@/actions/tickets', () => ({
  getTicketsPaginated: jest.fn(),
}));

// Stable router and search params, like Next's: the global mock hands out new
// ones on every render, which resets a filter chosen in the UI.
jest.mock('next/navigation', () => {
  const searchParams = new URLSearchParams();
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };
  return {
    useRouter: () => router,
    useSearchParams: () => searchParams,
    usePathname: () => '/tickets',
  };
});

jest.mock('@/contexts/company-context', () => ({
  useCompany: jest.fn(),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: jest.fn(),
}));

jest.mock('@/lib/offline-snapshot', () => ({
  formatOfflineSnapshotBanner: jest.fn(
    (updatedAt: string) => `Sin conexión — datos de ${updatedAt}`,
  ),
  readOfflineSnapshot: jest.fn(),
  writeOfflineSnapshot: jest.fn(),
}));

const mockGetTicketsPaginated = getTicketsPaginated as jest.MockedFunction<
  typeof getTicketsPaginated
>;
const mockUseCompany = useCompany as jest.MockedFunction<typeof useCompany>;
const mockUsePermissions = usePermissions as jest.MockedFunction<
  typeof usePermissions
>;
const mockReadOfflineSnapshot = readOfflineSnapshot as jest.MockedFunction<
  typeof readOfflineSnapshot
>;
const mockWriteOfflineSnapshot = writeOfflineSnapshot as jest.MockedFunction<
  typeof writeOfflineSnapshot
>;

const selectedCompany = {
  id: 1,
  name: 'Acme',
  logo: () => null,
  logoUrl: null,
  plan: 'basic',
  is_system: false,
};

const makeTicket = (overrides = {}) => ({
  id: BigInt(10),
  client_id: 1,
  client_name: 'Cliente Alfa',
  client_tel: '5551234567',
  email: 'alfa@example.com',
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 100,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
  ...overrides,
});

const paginatedResult = (
  items: ReturnType<typeof makeTicket>[],
  summary: {
    dueCount?: number;
    counts?: { all: number; due: number; inProgress: number; paid: number };
  } = {},
): Awaited<ReturnType<typeof getTicketsPaginated>> => {
  const due = summary.dueCount ?? 0;
  const counts = summary.counts ?? {
    all: items.length,
    due,
    inProgress: 0,
    paid: 0,
  };
  return {
  success: true,
  data: {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    counts,
    dueCount: summary.dueCount ?? counts.due,
  },
  };
};

const arrange = ({
  canWrite = true,
  result = paginatedResult([]),
}: {
  canWrite?: boolean;
  result?: Awaited<ReturnType<typeof getTicketsPaginated>>;
} = {}) => {
  mockUseCompany.mockReturnValue({
    selectedCompany,
    setSelectedCompany: jest.fn(),
  });
  mockUsePermissions.mockReturnValue({
    isSystem: false,
    permissions: canWrite ? ['tickets.read', 'tickets.write'] : ['tickets.read'],
    loading: false,
    can: (permission?: string) =>
      !permission ||
      (canWrite
        ? ['tickets.read', 'tickets.write'].includes(permission)
        : permission === 'tickets.read'),
    refresh: jest.fn(),
  });
  mockGetTicketsPaginated.mockResolvedValue(result);
};

const mockMobileViewport = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
};

/** From lg the desktop tree mounts instead (ZIG-I33-2, DesktopSwitch). */
const mockDesktopViewport = () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024px'),
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

describe('TicketsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadOfflineSnapshot.mockResolvedValue(null);
    mockWriteOfflineSnapshot.mockResolvedValue({} as never);
  });

  afterEach(() => {
    // No matchMedia is the phone, as in jsdom by default.
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    (useSearchParams() as unknown as URLSearchParams).delete('orden');
  });

  it('keeps the search input mounted while tickets reload', async () => {
    const first = paginatedResult([makeTicket()]);
    arrange({ result: first });

    render(<TicketsList />);

    const input = await screen.findByPlaceholderText('Cliente, número de ticket o teléfono');
    await waitFor(() => {
      expect(screen.getAllByText('Cliente Alfa').length).toBeGreaterThan(0);
    });

    let resolveReload: (value: typeof first) => void = () => undefined;
    mockGetTicketsPaginated.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReload = resolve;
      }),
    );
    input.focus();
    fireEvent.change(input, { target: { value: 'Alfa' } });

    // The debounced search triggers a reload that stays pending.
    expect(await screen.findByText('Cargando tickets')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cliente, número de ticket o teléfono')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Alfa');

    resolveReload(first);
    await waitFor(() => {
      expect(screen.queryByText('Cargando tickets')).not.toBeInTheDocument();
    });
    expect(input).toHaveFocus();
  });

  it('shows empty state after loading tickets', async () => {
    arrange();

    render(<TicketsList />);

    expect(
      await screen.findByText('Sin tickets'),
    ).toBeInTheDocument();
  });

  it('renders ticket rows when data is available', async () => {
    arrange({
      result: paginatedResult([makeTicket()]),
    });

    render(<TicketsList />);

    await waitFor(() => {
      expect(screen.getAllByText('Cliente Alfa').length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText(/buscar tickets/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockWriteOfflineSnapshot).toHaveBeenCalledWith(
        'tickets',
        selectedCompany.id,
        expect.arrayContaining([expect.objectContaining({ client_name: 'Cliente Alfa' })]),
      );
    });
  });

  it('refreshes tickets from a mobile pull gesture', async () => {
    mockMobileViewport();
    arrange({
      result: paginatedResult([makeTicket()]),
    });

    render(<TicketsList />);

    await waitFor(() => {
      expect(mockGetTicketsPaginated).toHaveBeenCalledTimes(1);
    });

    const pullArea = screen.getByTestId('tickets-pull-to-refresh');
    fireEvent.touchStart(pullArea, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(pullArea, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(pullArea);

    await waitFor(() => {
      expect(mockGetTicketsPaginated).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a read-only offline snapshot on network load failure', async () => {
    const snapshotUpdatedAt = '2026-08-10T05:00:00.000Z';
    arrange({
      result: {
        success: false,
        error: 'No hay red',
        errorType: 'network',
      },
    });
    mockReadOfflineSnapshot.mockResolvedValue({
      key: 'tickets:v1:company:1',
      resource: 'tickets',
      companyKey: 'company:1',
      schemaVersion: 1,
      updatedAt: snapshotUpdatedAt,
      data: [makeTicket({ client_name: 'Cliente Snapshot' })],
    });

    render(<TicketsList />);

    expect(
      await screen.findByText(
        new RegExp(`Sin conexión — datos de ${snapshotUpdatedAt}`),
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Cliente Snapshot').length).toBeGreaterThan(0);
  });

  it('shows the Por cobrar count from the server, no saldo total, and the chips drive the status filter (ZIG-I13-7, ZIG-I27-3)', async () => {
    arrange({
      result: paginatedResult([makeTicket()], { dueCount: 3 }),
    });

    render(<TicketsList />);

    const group = await screen.findByRole('group', { name: 'Filtro de cobro' });
    expect(screen.queryByTestId('tickets-balance-due')).not.toBeInTheDocument();
    expect(within(group).queryByText(/^Por cobrar$/)).not.toBeInTheDocument();
    const todos = within(group).getByRole('button', { name: 'Todos' });
    const porCobrar = within(group).getByRole('button', { name: 'Por cobrar · 3' });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(porCobrar).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(porCobrar);

    await waitFor(() =>
      expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'due' }),
      ),
    );
    expect(
      within(screen.getByRole('group', { name: 'Filtro de cobro' })).getByRole('button', {
        name: /Por cobrar/,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(screen.getByRole('group', { name: 'Filtro de cobro' })).getByRole('button', { name: 'Pagados' }));
    await waitFor(() =>
      expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'paid' }),
      ),
    );
  });

  it('keeps the search focus when a chip reloads the list', async () => {
    arrange({ result: paginatedResult([makeTicket()], { dueCount: 1 }) });

    render(<TicketsList />);

    const input = await screen.findByPlaceholderText('Cliente, número de ticket o teléfono');
    input.focus();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Filtro de cobro' })).getByRole('button', {
        name: /Por cobrar/,
      }),
    );
    await waitFor(() => expect(mockGetTicketsPaginated).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText('Cliente, número de ticket o teléfono')).toBe(input);
  });

  it('maps the desktop views onto status and finished (ZIG-I28-4)', async () => {
    mockDesktopViewport();
    arrange({
      result: paginatedResult([makeTicket()], {
        counts: { all: 8, due: 3, inProgress: 2, paid: 1 },
      }),
    });

    render(<TicketsList />);

    const views = await screen.findByRole('navigation', { name: 'Vistas de tickets' });
    expect(within(views).getByRole('button', { name: /Todos/ })).toHaveTextContent('8');
    expect(within(views).getByRole('button', { name: /Por cobrar/ })).toHaveTextContent('3');
    expect(views).not.toHaveTextContent('$');
    // The heading counts the whole list, not the page or the view (canvas «Tickets · 60»).
    expect(await screen.findByRole('heading', { name: /Tickets · 8/ })).toHaveClass(
      'text-2xl',
      'font-semibold',
    );

    fireEvent.click(within(views).getByRole('button', { name: /En proceso/ }));
    await waitFor(() =>
      expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'all', finishedFilter: 'no' }),
      ),
    );

    fireEvent.click(within(views).getByRole('button', { name: /Pagados/ }));
    await waitFor(() =>
      expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'paid', finishedFilter: 'all' }),
      ),
    );

    fireEvent.click(within(views).getByRole('button', { name: /Todos/ }));
    await waitFor(() =>
      expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'all', finishedFilter: 'all' }),
      ),
    );
  });

  describe('desktop (ZIG-I33-2)', () => {
    const manyTickets = (n: number) =>
      Array.from({ length: n }, (_, index) =>
        makeTicket({ id: BigInt(100 + index), client_name: `Cliente ${index}`, total: 100 + index }),
      );

    it('asks the server for the newest ticket date first and shows title, table card and footer', async () => {
      mockDesktopViewport();
      arrange({ result: paginatedResult([makeTicket()]) });

      render(<TicketsList />);

      expect(await screen.findByRole('table', { name: 'Tickets' })).toBeInTheDocument();
      expect(mockGetTicketsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 25, sort: { column: 'fecha', direction: 'desc' } }),
      );
      expect(screen.getByRole('heading', { level: 1, name: /Tickets · 1/ })).toBeInTheDocument();
      expect(screen.getByText('Lista de todos los tickets registrados')).toBeInTheDocument();
      // One Nuevo ticket, at the title; no sort select, no phone cards.
      expect(screen.getAllByRole('link', { name: /Nuevo ticket/ })).toHaveLength(1);
      expect(screen.queryByRole('combobox', { name: /ordenar/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('tickets-pull-to-refresh')).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute('aria-sort', 'descending');
      expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveClass('text-right');
      expect(screen.getByTestId('list-footer')).toHaveTextContent('1 de 1 tickets');
      expect(screen.getAllByTestId('tickets-row')).toHaveLength(1);
    });

    it('sorts the whole list on the server from the header and writes ?orden=', async () => {
      mockDesktopViewport();
      arrange({ result: paginatedResult([makeTicket()]) });
      const router = useRouter();

      render(<TicketsList />);
      fireEvent.click(await screen.findByRole('button', { name: 'Total' }));

      await waitFor(() =>
        expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, sort: { column: 'total', direction: 'desc' } }),
        ),
      );
      expect(router.replace).toHaveBeenCalledWith('/tickets?orden=total-desc', { scroll: false });
      expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveAttribute('aria-sort', 'descending');

      fireEvent.click(screen.getByRole('button', { name: 'Total' }));
      await waitFor(() =>
        expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
          expect.objectContaining({ sort: { column: 'total', direction: 'asc' } }),
        ),
      );
    });

    it('reads the old ?orden= of the sort select', async () => {
      mockDesktopViewport();
      (useSearchParams() as unknown as URLSearchParams).set('orden', 'paymentRank:desc');
      arrange({ result: paginatedResult([makeTicket()]) });

      render(<TicketsList />);

      await waitFor(() =>
        expect(mockGetTicketsPaginated).toHaveBeenCalledWith(
          expect.objectContaining({ sort: { column: 'estado', direction: 'desc' } }),
        ),
      );
      expect(await screen.findByRole('columnheader', { name: /Estado/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
    });

    it('pages on the server with a numbered pager and keeps the rows, dimmed, while the next page loads', async () => {
      mockDesktopViewport();
      const first = paginatedResult(manyTickets(25));
      if (!first.data) throw new Error('no data');
      first.data.total = 60;
      arrange({ result: first });

      render(<TicketsList />);
      expect(await screen.findByText('1–25 de 60 tickets')).toBeInTheDocument();

      mockGetTicketsPaginated.mockReturnValueOnce(new Promise(() => undefined));
      fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));

      await waitFor(() =>
        expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
      );
      const table = screen.getByRole('table', { name: 'Tickets' });
      expect(table).toHaveAttribute('aria-busy', 'true');
      expect(table).toHaveClass('opacity-60');
      expect(screen.queryByText('Cargando tickets')).not.toBeInTheDocument();
    });

    it('clears the filters but never the order', async () => {
      mockDesktopViewport();
      arrange({ result: paginatedResult([makeTicket()]) });

      render(<TicketsList />);
      fireEvent.click(await screen.findByRole('button', { name: 'Saldo' }));
      const views = screen.getByRole('navigation', { name: 'Vistas de tickets' });
      fireEvent.click(within(views).getByRole('button', { name: /Pagados/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));

      await waitFor(() =>
        expect(mockGetTicketsPaginated).toHaveBeenLastCalledWith(
          expect.objectContaining({ statusFilter: 'all', sort: { column: 'saldo', direction: 'desc' } }),
        ),
      );
    });
  });
});
