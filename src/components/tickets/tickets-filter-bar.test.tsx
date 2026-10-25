import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketsFilterBar } from '@/components/tickets/tickets-filter-bar';
import { DEFAULT_TICKET_SORTING } from '@/components/tickets/tickets-sort-presets';

const baseProps = {
  searchValue: '',
  onSearchChange: jest.fn(),
  statusFilter: 'all' as const,
  onStatusFilterChange: jest.fn(),
  finishedFilter: 'all' as const,
  onFinishedFilterChange: jest.fn(),
  dateRange: undefined,
  onDateRangeChange: jest.fn(),
  sorting: DEFAULT_TICKET_SORTING,
  onSortingChange: jest.fn(),
  activeFilterCount: 0,
  hasActiveFilters: false,
  onClearFilters: jest.fn(),
  filterChips: [],
};

describe('TicketsFilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input and forwards changes', async () => {
    const user = userEvent.setup();
    const onSearchChange = jest.fn();

    render(
      <TicketsFilterBar {...baseProps} onSearchChange={onSearchChange} />,
    );

    const input = screen.getByLabelText(/buscar tickets/i);
    await user.type(input, 'alfa');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('shows active filter count on the mobile filter trigger', () => {
    render(
      <TicketsFilterBar
        {...baseProps}
        activeFilterCount={2}
        hasActiveFilters
        filterChips={[{ key: 'status', label: 'Pendiente' }]}
      />,
    );

    expect(
      screen.getByRole('button', { name: /más filtros \(2 activos\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('calls onClearFilters from the desktop clear button', async () => {
    const user = userEvent.setup();
    const onClearFilters = jest.fn();

    render(
      <TicketsFilterBar
        {...baseProps}
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );

    await user.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('does not render Con PDF / Sin PDF filter controls', async () => {
    const user = userEvent.setup();
    render(<TicketsFilterBar {...baseProps} />);

    expect(screen.queryByLabelText(/filtrar por pdf/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Con PDF')).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('list-mobile-controls')).getByRole('button', { name: /más filtros/i }),
    );
    expect(screen.queryByLabelText(/filtrar por pdf/i)).not.toBeInTheDocument();
  });

  it('keeps a single payment filter: the Por cobrar chips (ZIG-24)', async () => {
    const user = userEvent.setup();
    render(<TicketsFilterBar {...baseProps} />);

    expect(screen.queryByLabelText('Filtrar por pagado')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Por cobrar' }).length).toBeGreaterThan(0);

    await user.click(
      within(screen.getByTestId('list-mobile-controls')).getByRole('button', { name: /más filtros/i }),
    );
    expect(screen.queryByLabelText('Filtrar por pagado')).not.toBeInTheDocument();
  });

  it('shows the phone sort beside Más filtros (ZIG-I18-9)', () => {
    render(<TicketsFilterBar {...baseProps} />);

    const controls = screen.getByTestId('list-mobile-controls');
    expect(within(controls).getByRole('button', { name: /más filtros/i })).toBeInTheDocument();
    expect(
      within(controls).getByRole('combobox', { name: /ordenar lista de tickets/i }),
    ).toHaveTextContent('Más recientes');
  });

  it('keeps Trabajo in the phone sheet and Fechas on the desktop bar (ZIG-I28-4)', async () => {
    const user = userEvent.setup();
    render(<TicketsFilterBar {...baseProps} />);

    expect(screen.queryByRole('combobox', { name: 'Trabajo' })).not.toBeInTheDocument();
    expect(screen.getByText('Fechas')).toBeInTheDocument();
    expect(screen.getByText('Cobro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por cliente, folio o teléfono').parentElement).toHaveClass(
      'max-w-[360px]',
    );

    await user.click(
      within(screen.getByTestId('list-mobile-controls')).getByRole('button', { name: /más filtros/i }),
    );
    expect(screen.getByRole('combobox', { name: 'Trabajo' })).toBeInTheDocument();
  });

  it('tints the chosen chip instead of the solid page-action style (ZIG-I27-3)', () => {
    render(<TicketsFilterBar {...baseProps} statusFilter="due" dueCount={4} />);

    const group = screen.getByRole('group', { name: 'Filtro de cobro' });
    const chosen = within(group).getByRole('button', { name: 'Por cobrar · 4' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(chosen.className).toContain('bg-primary/10');
    expect(chosen.className).not.toMatch(/\bbg-foreground\b/);
  });

  it('never shows a Por cobrar total (ZIG-I27-3)', () => {
    render(<TicketsFilterBar {...baseProps} dueCount={4} />);

    expect(screen.queryByTestId('tickets-balance-due')).not.toBeInTheDocument();
  });

  it('clears filters with a neutral button, not a destructive one (ZIG-I27-3)', () => {
    render(<TicketsFilterBar {...baseProps} hasActiveFilters />);

    const clear = screen.getByRole('button', { name: 'Limpiar filtros' });
    expect(clear.className).not.toContain('text-destructive');
  });

  it('tints the selected collection tab and never shows money (ZIG-I28-4)', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = jest.fn();
    const onFinishedFilterChange = jest.fn();
    render(
      <TicketsFilterBar
        {...baseProps}
        statusFilter="due"
        finishedFilter="all"
        counts={{ all: 8, due: 3, inProgress: 2, paid: 1 }}
        onStatusFilterChange={onStatusFilterChange}
        onFinishedFilterChange={onFinishedFilterChange}
      />,
    );

    const views = screen.getByRole('navigation', { name: 'Vistas de tickets' });
    expect(views).not.toHaveTextContent('$');
    const due = within(views).getByRole('button', { name: 'Por cobrar 3' });
    expect(due).toHaveAttribute('aria-pressed', 'true');
    expect(due.className).toContain('bg-primary/10');
    expect(due.className).not.toMatch(/(?:^|\s)bg-primary(?:\s|$)/);
    expect(within(views).getByRole('button', { name: 'En proceso 2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(within(views).getByRole('button', { name: 'En proceso 2' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('all');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('no');

    await user.click(within(views).getByRole('button', { name: 'Pagados 1' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('paid');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('all');

    await user.click(within(views).getByRole('button', { name: 'Todos 8' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('all');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('all');
  });

  it('opens the desktop sort from Más filtros and has no CSV export', async () => {
    const user = userEvent.setup();
    render(<TicketsFilterBar {...baseProps} />);

    expect(screen.queryByRole('button', { name: /csv|exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Fecha del ticket (recientes primero)')).not.toBeInTheDocument();

    const desktop = screen.getByRole('navigation', { name: 'Vistas de tickets' }).parentElement;
    if (!desktop) throw new Error('desktop bar missing');
    await user.click(within(desktop).getByRole('button', { name: 'Más filtros' }));
    expect(screen.getByText('Fecha del ticket (recientes primero)')).toBeInTheDocument();
  });
});
