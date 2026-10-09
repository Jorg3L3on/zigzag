import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('shows a compact summary (qty × price, subtotal) without steppers outside the desktop editor', () => {
    render(
      <TicketServiceRow
        serviceTicket={{ ...serviceTicket, quantity: 3, price: 4200 }}
        onUpdate={jest.fn()}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId('ticket-service-row-summary')).toHaveTextContent(
      '3 × $4,200.00',
    );
    expect(screen.getAllByText('$12,600.00').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Opciones de Limpieza' }),
    ).toBeInTheDocument();
  });

  it('edits quantity and price in the Editar sheet and saves through onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();

    render(
      <TicketServiceRow
        serviceTicket={serviceTicket}
        onUpdate={onUpdate}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Opciones de Limpieza' }));
    await user.click(await screen.findByRole('menuitem', { name: /Editar/ }));

    const sheet = await screen.findByRole('dialog', { name: 'Editar Limpieza' });
    await user.click(
      within(sheet).getByRole('button', { name: 'Aumentar cantidad del servicio' }),
    );
    const price = within(sheet).getByLabelText('Precio del servicio');
    await user.clear(price);
    await user.type(price, '75.5');

    expect(
      within(sheet).getByTestId('ticket-service-edit-subtotal'),
    ).toHaveAttribute('data-value', '226.5');
    expect(onUpdate).not.toHaveBeenCalled();

    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(onUpdate).toHaveBeenCalledWith(9, 3, 75.5);
  });

  it('discards the draft on Cancelar', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();

    render(
      <TicketServiceRow
        serviceTicket={serviceTicket}
        onUpdate={onUpdate}
        onQuantityInput={jest.fn()}
        onPriceInput={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Opciones de Limpieza' }));
    await user.click(await screen.findByRole('menuitem', { name: /Editar/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar Limpieza' });
    await user.click(
      within(sheet).getByRole('button', { name: 'Aumentar cantidad del servicio' }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Cancelar' }));

    expect(onUpdate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar Limpieza' })).toBeNull(),
    );
  });

  it('removes the line after confirming Quitar', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Opciones de Limpieza' }));
    await user.click(await screen.findByRole('menuitem', { name: /Quitar/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Quitar' }));
    expect(onDelete).toHaveBeenCalledWith(9);
  });
});
