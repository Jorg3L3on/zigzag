import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteTicketButton } from '@/components/delete-ticket-button';

const mockDeleteTicket = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

jest.mock('@/actions/tickets', () => ({
  deleteTicket: (...args: unknown[]) => mockDeleteTicket(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));

describe('DeleteTicketButton (ZIG-I13-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks in a sheet naming what is lost, then removes the row optimistically and stays on the list', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    mockDeleteTicket.mockResolvedValue({ success: true });

    render(
      <DeleteTicketButton
        id={42}
        clientName="Cliente Alfa"
        total={250}
        paid={100}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /eliminar ticket 42/i }));
    expect(mockDeleteTicket).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    const sheet = await screen.findByRole('dialog', { name: '¿Eliminar el ticket #42?' });
    expect(sheet).toHaveTextContent('Cliente Alfa');
    expect(sheet).toHaveTextContent('$250.00');
    expect(sheet).toHaveTextContent('Tiene pagos registrados por $100.00');
    expect(sheet).not.toHaveTextContent(/papelera/i);

    await user.click(screen.getByRole('button', { name: 'Eliminar ticket' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(42);
      expect(mockDeleteTicket).toHaveBeenCalledWith(42, null);
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
    // The list stays where it is: no navigation.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Conservar closes the sheet and deletes nothing', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();

    render(<DeleteTicketButton id={42} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /eliminar ticket 42/i }));
    await user.click(await screen.findByRole('button', { name: 'Conservar' }));

    expect(mockDeleteTicket).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('restores the row and shows the real error when delete fails', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onDeleteFailed = jest.fn();
    mockDeleteTicket.mockResolvedValue({
      success: false,
      error: 'Intenta de nuevo en unos momentos. Código: TC005',
      errorType: 'server',
    });

    render(
      <DeleteTicketButton
        id={42}
        companyId={10}
        onDelete={onDelete}
        onDeleteFailed={onDeleteFailed}
      />,
    );

    await user.click(screen.getByRole('button', { name: /eliminar ticket 42/i }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar ticket' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(42);
      expect(mockDeleteTicket).toHaveBeenCalledWith(42, 10);
      expect(onDeleteFailed).toHaveBeenCalledWith(42);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/TC005|eliminar/i),
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });
});
