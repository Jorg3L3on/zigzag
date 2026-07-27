import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketRowActions } from '@/components/tickets/ticket-row-actions';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

jest.mock('@/components/delete-ticket-button', () => ({
  DeleteTicketButton: () => <button type="button">Eliminar</button>,
}));

describe('TicketRowActions', () => {
  const ticket = {
    id: BigInt(7),
    finished: true,
    total: 100,
    paid: 0,
    client_name: 'Cliente',
    ticket_date: new Date('2026-05-01T12:00:00Z'),
  };

  beforeEach(() => {
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    }) as jest.Mock;
    global.URL.createObjectURL = jest.fn(() => 'blob:ticket-pdf');
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Descargar ticket for finished tickets without a stored document', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={ticket} companyId={1} />);

    await user.click(
      screen.getByRole('button', { name: /más acciones del ticket 7/i }),
    );

    expect(
      screen.getByRole('menuitem', { name: /descargar ticket 7/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ver PDF')).not.toBeInTheDocument();
  });

  it('downloads on demand when Descargar ticket is selected', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={ticket} companyId={3} />);

    await user.click(
      screen.getByRole('button', { name: /más acciones del ticket 7/i }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: /descargar ticket 7/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tickets/7/invoice?company_id=3',
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });
});
