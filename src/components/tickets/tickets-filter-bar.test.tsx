import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketsFilterBar } from '@/components/tickets/tickets-filter-bar';
import { DEFAULT_TICKET_SORTING } from '@/components/tickets/tickets-sort-presets';

const baseProps = {
  searchValue: '',
  onSearchChange: jest.fn(),
  statusFilter: 'all' as const,
  onStatusFilterChange: jest.fn(),
  pdfFilter: 'all' as const,
  onPdfFilterChange: jest.fn(),
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
      screen.getByRole('button', { name: /abrir filtros \(2 activos\)/i }),
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
});
