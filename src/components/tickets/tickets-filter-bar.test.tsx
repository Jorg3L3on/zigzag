import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TicketCollectionTabs,
  TicketsDesktopToolbar,
  TicketsFilterBar,
} from '@/components/tickets/tickets-filter-bar';
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

  it('keeps Trabajo, the dates and the order in the phone sheet (ZIG-I28-4)', async () => {
    const user = userEvent.setup();
    render(<TicketsFilterBar {...baseProps} />);

    expect(screen.queryByRole('combobox', { name: 'Trabajo' })).not.toBeInTheDocument();
    expect(screen.getByText('Cobro')).toBeInTheDocument();
    // The phone bar has no desktop pieces since ZIG-I33-2.
    expect(screen.queryByRole('navigation', { name: 'Vistas de tickets' })).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('list-mobile-controls')).getByRole('button', { name: /más filtros/i }),
    );
    expect(screen.getByRole('combobox', { name: 'Trabajo' })).toBeInTheDocument();
    expect(screen.getByText('Fechas', { exact: true })).toBeInTheDocument();
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

});

const toolbarProps = {
  searchValue: '',
  onSearchChange: jest.fn(),
  finishedFilter: 'all' as const,
  onFinishedFilterChange: jest.fn(),
  dateRange: undefined,
  onDateRangeChange: jest.fn(),
  hasActiveFilters: false,
  onClearFilters: jest.fn(),
};

describe('TicketsDesktopToolbar (ZIG-I33-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is one row: search, dates, the Terminado pill and Columnas, with no order select or CSV', () => {
    render(
      <TicketsDesktopToolbar {...toolbarProps} columnsMenu={<button type="button">Columnas</button>} />,
    );

    expect(screen.getByRole('textbox', { name: 'Buscar por cliente, folio o teléfono' })).toHaveAttribute(
      'placeholder',
      'Buscar por cliente, folio o teléfono',
    );
    // Canvas ListaA: «Todas las fechas» with no label above it.
    expect(screen.getByRole('button', { name: 'Filtrar por rango de fechas del ticket' })).toHaveTextContent(
      'Todas las fechas',
    );
    expect(screen.queryByText('Fechas', { exact: true })).not.toBeInTheDocument();
    const terminado = screen.getByRole('combobox', { name: 'Filtrar por trabajo terminado' });
    expect(terminado).toHaveTextContent('Todos los trabajos');
    expect(terminado.className).toContain('rounded-full');
    expect(terminado.className).not.toContain('bg-primary/10');
    expect(screen.getByRole('button', { name: 'Columnas' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /ordenar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más filtros' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /csv|exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('tints a chosen Terminado and clears with a neutral button', async () => {
    const user = userEvent.setup();
    const onClearFilters = jest.fn();
    render(
      <TicketsDesktopToolbar
        {...toolbarProps}
        finishedFilter="no"
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );

    const terminado = screen.getByRole('combobox', { name: 'Filtrar por trabajo terminado' });
    expect(terminado).toHaveTextContent('En proceso');
    expect(terminado.className).toContain('bg-primary/10');
    const clear = screen.getByRole('button', { name: 'Limpiar filtros' });
    expect(clear.className).not.toContain('text-destructive');
    await user.click(clear);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

describe('TicketCollectionTabs', () => {
  it('tints the selected collection tab and never shows money (ZIG-I28-4)', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = jest.fn();
    const onFinishedFilterChange = jest.fn();
    render(
      <TicketCollectionTabs
        statusFilter="due"
        finishedFilter="yes"
        counts={{ all: 8, due: 3, inProgress: 2, paid: 1 }}
        onStatusFilterChange={onStatusFilterChange}
        onFinishedFilterChange={onFinishedFilterChange}
      />,
    );

    const views = screen.getByRole('navigation', { name: 'Vistas de tickets' });
    expect(views).not.toHaveTextContent('$');
    // Canvas ListaA: «Por cobrar» over «3 tickets», chosen = underline, not solid blue.
    const due = within(views).getByRole('button', { name: 'Por cobrar 3 tickets' });
    expect(due).toHaveAttribute('aria-pressed', 'true');
    expect(due.className).toContain('border-primary');
    expect(due.className).not.toMatch(/(?:^|\s)bg-primary(?:\s|$)/);
    expect(within(views).getByRole('button', { name: 'En proceso 2 tickets' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(within(views).getByRole('button', { name: 'En proceso 2 tickets' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('all');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('no');

    await user.click(within(views).getByRole('button', { name: 'Pagados 1 ticket' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('paid');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('all');

    await user.click(within(views).getByRole('button', { name: 'Todos 8 tickets' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('all');
    expect(onFinishedFilterChange).toHaveBeenCalledWith('all');
  });
});
