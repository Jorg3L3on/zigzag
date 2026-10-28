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

const mockDeleteTicket = jest.fn();
jest.mock('@/actions/tickets', () => ({
  applyTicketPayment: jest.fn(),
  deleteTicket: (...args: unknown[]) => mockDeleteTicket(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));

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

  it('names the folio people see, not the internal id, in every row action label', async () => {
    const user = userEvent.setup();
    const withFolio = { ...ticket, id: BigInt(1121), folio_prefix: 'R', folio_number: 60 };
    render(<TicketRowActions ticket={withFolio} onDelete={jest.fn()} canWrite />);
    await user.click(screen.getByRole('button', { name: 'Más acciones de R-0060' }));
    expect(await screen.findByRole('menuitem', { name: 'Cobrar R-0060' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Descargar R-0060' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Eliminar R-0060' })).toBeInTheDocument();
    expect(screen.queryByText(/1121/)).toBeNull();
  });

  it('puts Terminar in the menu of an open ticket when the table passes its link (ZIG-33)', async () => {
    const user = userEvent.setup();
    render(
      <TicketRowActions
        ticket={{ ...ticket, finished: false }}
        onDelete={jest.fn()}
        canWrite
       
        finishHref="/tickets/7"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Más acciones de #7' }));
    const terminar = await screen.findByRole('menuitem', { name: 'Terminar #7' });
    expect(terminar.closest('a')).toHaveAttribute('href', '/tickets/7');
  });

  it('has no Terminar without a finish link or once the ticket is finished', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TicketRowActions ticket={{ ...ticket, finished: false }} canWrite />);
    await user.click(screen.getByRole('button', { name: 'Más acciones de #7' }));
    await screen.findByRole('menuitem', { name: /ver detalles/i });
    expect(screen.queryByRole('menuitem', { name: /terminar/i })).toBeNull();
    unmount();
    render(<TicketRowActions ticket={ticket} canWrite finishHref="/tickets/7" />);
    await user.click(screen.getByRole('button', { name: 'Más acciones de #7' }));
    await screen.findByRole('menuitem', { name: /ver detalles/i });
    expect(screen.queryByRole('menuitem', { name: /terminar/i })).toBeNull();
  });

  it('offers no Llamar, even when the client has a phone (ZIG-27)', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={{ ...ticket, client_tel: '998 345 7712' }} canWrite />);
    await user.click(screen.getByRole('button', { name: /más acciones de #7/i }));
    await screen.findByRole('menuitem', { name: /ver detalles/i });
    expect(screen.queryByRole('menuitem', { name: /llamar/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows Descargar ticket for finished tickets without a stored document', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={ticket} companyId={1} />);

    await user.click(
      screen.getByRole('button', { name: /más acciones de #7/i }),
    );

    expect(
      screen.getByRole('menuitem', { name: /descargar #7/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ver PDF')).not.toBeInTheDocument();
  });

  it('downloads on demand when Descargar ticket is selected', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={ticket} companyId={3} />);

    await user.click(
      screen.getByRole('button', { name: /más acciones de #7/i }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: /descargar #7/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tickets/7/invoice?company_id=3',
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('shows Cobrar for finished unpaid tickets and opens the dialog', async () => {
    const user = userEvent.setup();
    render(
      <TicketRowActions
        ticket={{ ...ticket, paid: 25, finished: true }}
        companyId={1}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /más acciones de #7/i }),
    );
    expect(screen.queryByText('Cobrar saldo')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('menuitem', { name: /cobrar #7/i }),
    );
    expect(
      screen.getByRole('heading', { name: /^cobrar$/i }),
    ).toBeInTheDocument();
  });

  it('hides Cobrar for saldado tickets', async () => {
    const user = userEvent.setup();
    render(
      <TicketRowActions
        ticket={{ ...ticket, paid: 100, finished: true }}
        companyId={1}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /más acciones de #7/i }),
    );
    expect(
      screen.queryByRole('menuitem', { name: /^cobrar$/i }),
    ).not.toBeInTheDocument();
  });

  it('Eliminar closes the menu and opens the sheet with the client, total and payments; Conservar keeps the row (ZIG-I13-6)', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(
      <TicketRowActions
        ticket={{ ...ticket, paid: 40 }}
        canWrite
        companyId={1}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /más acciones de #7/i }));
    await user.click(screen.getByRole('menuitem', { name: /eliminar #7/i }));

    const sheet = await screen.findByRole('dialog', { name: '¿Eliminar el ticket #7?' });
    expect(sheet).toHaveTextContent('Cliente');
    expect(sheet).toHaveTextContent('$100.00');
    expect(sheet).toHaveTextContent('Tiene pagos registrados por $40.00');
    expect(sheet).not.toHaveTextContent(/papelera/i);
    // The menu is gone: the page behind is reachable again once the sheet closes.
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Conservar' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(mockDeleteTicket).not.toHaveBeenCalled();
  });

  it('confirming removes the row optimistically and deletes; a failure restores it', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onDeleteFailed = jest.fn();
    mockDeleteTicket.mockResolvedValue({ success: false, error: 'Código: TC005', errorType: 'server' });
    render(
      <TicketRowActions
        ticket={ticket}
        canWrite
        companyId={1}
        onDelete={onDelete}
        onDeleteFailed={onDeleteFailed}
      />,
    );

    await user.click(screen.getByRole('button', { name: /más acciones de #7/i }));
    await user.click(screen.getByRole('menuitem', { name: /eliminar #7/i }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar ticket' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(7);
      expect(mockDeleteTicket).toHaveBeenCalledWith(7, 1);
      expect(onDeleteFailed).toHaveBeenCalledWith(7);
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('hides Eliminar without write access', async () => {
    const user = userEvent.setup();
    render(<TicketRowActions ticket={ticket} canWrite={false} companyId={1} />);

    await user.click(screen.getByRole('button', { name: /más acciones de #7/i }));

    expect(screen.queryByRole('menuitem', { name: /eliminar #7/i })).toBeNull();
  });
});
