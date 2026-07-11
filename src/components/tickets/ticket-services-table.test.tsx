import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketServicesTable } from '@/components/tickets/ticket-services-table';

jest.mock('@/components/tickets/ticket-service-row', () => ({
  TicketServiceRow: ({
    serviceTicket,
    onDelete,
  }: {
    serviceTicket: { id: number; service: { name: string } };
    onDelete: (id: number) => void;
  }) => (
    <div>
      <span>{serviceTicket.service.name}</span>
      <button type="button" onClick={() => onDelete(serviceTicket.id)}>
        Eliminar
      </button>
    </div>
  ),
}));

const serviceTicket = {
  id: 4,
  service_id: 2,
  quantity: 2,
  price: 75,
  service: {
    id: 2,
    name: 'Mantenimiento',
    description: 'Servicio recurrente',
    price: '75.00',
    company_id: 1,
    created_at: new Date('2026-05-01T00:00:00Z'),
    updated_at: new Date('2026-05-01T00:00:00Z'),
    deleted_at: null,
  },
};

describe('TicketServicesTable', () => {
  it('renders empty state when there are no line items', () => {
    render(
      <TicketServicesTable
        ticketId="12"
        ticketServices={[]}
        onUpdate={jest.fn()}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={jest.fn()}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/no hay servicios asignados a este ticket/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continuar a revisión/i }),
    ).toBeDisabled();
  });

  it('shows total and forwards navigation actions', async () => {
    const user = userEvent.setup();
    const onContinue = jest.fn();
    const onBack = jest.fn();
    const onDelete = jest.fn();

    render(
      <TicketServicesTable
        ticketId="12"
        ticketServices={[serviceTicket]}
        onUpdate={jest.fn()}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={onDelete}
        onBack={onBack}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText('Mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /continuar a revisión/i }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole('button', { name: /volver a datos del ticket/i }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(onDelete).toHaveBeenCalledWith(4);
  });
});
