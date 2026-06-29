import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketServiceRow } from '@/components/tickets/ticket-service-row';

jest.mock('@/components/tripled', () => ({
  TripledNativeDelete: ({
    onDelete,
    buttonText,
  }: {
    onDelete: () => void;
    buttonText: string;
  }) => (
    <button type="button" onClick={onDelete}>
      {buttonText}
    </button>
  ),
}));

const serviceTicket = {
  id: 9,
  service_id: 3,
  quantity: 2,
  price: 50,
  service: {
    id: 3,
    name: 'Limpieza',
    description: 'Servicio de limpieza',
    price: '50.00',
    company_id: 1,
    created_at: new Date('2026-05-01T00:00:00Z'),
    updated_at: new Date('2026-05-01T00:00:00Z'),
    deleted_at: null,
  },
};

describe('TicketServiceRow', () => {
  it('renders service details and forwards delete', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();

    render(
      <TicketServiceRow
        serviceTicket={serviceTicket}
        onUpdate={jest.fn()}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Limpieza')).toBeInTheDocument();
    expect(screen.getByText('Servicio de limpieza')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /eliminar servicio/i }));
    expect(onDelete).toHaveBeenCalledWith(9);
  });
});
