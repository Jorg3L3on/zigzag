import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteTicketButton } from '@/components/delete-ticket-button';

const mockDeleteTicket = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/actions/tickets', () => ({
  deleteTicket: (...args: unknown[]) => mockDeleteTicket(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('DeleteTicketButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires confirmation before deleting and optimistically removes on confirm', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    mockDeleteTicket.mockResolvedValue({ success: true });

    render(<DeleteTicketButton id={42} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /eliminar ticket 42/i }));
    expect(mockDeleteTicket).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    expect(
      screen.getByRole('heading', { name: /eliminar ticket/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(42);
      expect(mockDeleteTicket).toHaveBeenCalledWith(42);
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
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
        onDelete={onDelete}
        onDeleteFailed={onDeleteFailed}
      />,
    );

    await user.click(screen.getByRole('button', { name: /eliminar ticket 42/i }));
    await user.click(screen.getByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(42);
      expect(onDeleteFailed).toHaveBeenCalledWith(42);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/TC005|eliminar/i),
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });
});
