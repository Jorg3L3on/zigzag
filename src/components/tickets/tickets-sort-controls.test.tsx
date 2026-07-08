import { render, screen } from '@testing-library/react';
import { TicketsSortControls } from '@/components/tickets/tickets-sort-controls';
import { DEFAULT_TICKET_SORTING } from '@/components/tickets/tickets-sort-presets';

describe('TicketsSortControls', () => {
  it('renders the mobile sort select with the current label', () => {
    render(
      <TicketsSortControls
        sorting={DEFAULT_TICKET_SORTING}
        onSortingChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/ordenar lista de tickets/i)).toBeInTheDocument();
    expect(
      screen.getByText(/fecha del ticket \(recientes primero\)/i),
    ).toBeInTheDocument();
  });
});
