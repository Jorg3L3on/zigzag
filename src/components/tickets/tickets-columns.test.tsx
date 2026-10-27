import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { createTicketsColumns, ticketListEstadoLabel } from '@/components/tickets/tickets-columns';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));

jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

jest.mock('@/actions/tickets', () => ({
  applyTicketPayment: jest.fn(),
  deleteTicket: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: BigInt(12),
  client_id: 1,
  client_name: 'Cliente Alfa',
  client_tel: '5551234567',
  email: null,
  document: null,
  folio_prefix: 'R',
  folio_number: 12,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 1000,
  paid: 200,
  finished: true,
  services_summary: 'Compresor, Mano de obra',
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
  ...overrides,
});

const TableHarness = ({
  ticket,
  canWrite = true,
}: {
  ticket: Ticket;
  canWrite?: boolean;
}) => {
  const columns = createTicketsColumns({
    onDelete: jest.fn(),
    canWrite,
    companyId: 1,
  }) as ColumnDef<Ticket>[];
  const table = useReactTable({
    data: [ticket],
    columns,
    state: { columnVisibility: { client_tel: false } },
    getCoreRowModel: getCoreRowModel(),
  });
  const row = table.getRowModel().rows[0]!;

  return (
    <table>
      <thead>
        <tr>
          {table.getHeaderGroups()[0]?.headers.map((header) => (
            <th key={header.id} className={header.column.columnDef.meta?.className}>
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {row.getVisibleCells().map((cell) => (
            <td key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

describe('ticket list estado (ZIG-I28-4)', () => {
  it('lets En proceso win only over Pendiente', () => {
    expect(ticketListEstadoLabel({ finished: false, total: 100, paid: 0 })).toBe('En proceso');
    expect(ticketListEstadoLabel({ finished: true, total: 100, paid: 0 })).toBe('Pendiente');
    expect(ticketListEstadoLabel({ finished: false, total: 100, paid: 40 })).toBe('En proceso');
    expect(ticketListEstadoLabel({ finished: true, total: 100, paid: 40 })).toBe('Pago parcial');
    expect(ticketListEstadoLabel({ finished: true, total: 100, paid: 100 })).toBe('Pagado');
  });
});

describe('tickets collection columns (ZIG-I28-4)', () => {
  const headers = () => screen.getAllByRole('columnheader');

  it('shows folio, client with phone, work, saldo and a one-line estado', () => {
    render(<TableHarness ticket={makeTicket()} />);

    expect(screen.getByText('R-0012')).toHaveClass('font-mono', 'text-caption');
    expect(screen.getByText('Cliente Alfa')).toHaveClass('text-sm', 'font-medium');
    // Phone as the canvas prints it: 555 123 4567.
    expect(screen.getByText('555 123 4567')).toHaveClass('text-caption');
    expect(screen.queryByRole('columnheader', { name: 'Teléfono' })).not.toBeInTheDocument();
    expect(screen.getByText('Compresor, Mano de obra')).toBeInTheDocument();

    const trabajo = headers().find((header) => header.textContent === 'Trabajo');
    expect(trabajo?.className).toContain('hidden');
    // Client names win: Trabajo only once Cliente keeps 21rem (its width at 1280).
    expect(trabajo?.className).toContain('@min-[75rem]:table-cell');
    const cliente = headers().find((header) => header.textContent === 'Cliente');
    expect(cliente?.className).toContain('@min-[75rem]:w-[21rem]');

    expect(screen.getByText((_, element) => {
      const text = element?.textContent?.replace(/\s/g, '') ?? '';
      return element?.classList.contains('font-semibold') === true && /800/.test(text);
    })).toBeInTheDocument();
    expect(screen.getByTestId('ticket-list-estado')).toHaveTextContent('Pago parcial');
    expect(screen.queryByTestId('ticket-payment-summary')).not.toBeInTheDocument();
  });

  it('uses an em dash for saldo and En proceso when the ticket is unfinished and unpaid', () => {
    render(
      <TableHarness
        ticket={makeTicket({
          finished: false,
          paid: 0,
          services_summary: null,
        })}
      />,
    );

    expect(screen.getByText('Sin servicios todavía')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('\u2014')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-list-estado')).toHaveTextContent('En proceso');
  });

  it('shows no buttons on the row, only ⋯ with Cobrar and the PDF for a finished ticket (ZIG-33)', async () => {
    const user = userEvent.setup();
    render(<TableHarness ticket={makeTicket()} />);

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).not.toContain(
      'Cobrar R-0012',
    );
    expect(screen.queryByRole('link', { name: /terminar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^más acciones de R-0012$/i }));
    expect(await screen.findByRole('menuitem', { name: /^cobrar R-0012$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^descargar R-0012$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /terminar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /^cobrar R-0012$/i }));
    expect(await screen.findByRole('heading', { name: /^cobrar ticket R-0012$/i })).toBeInTheDocument();
  });

  it('puts Terminar in ⋯, linked to the detail, while the work is in progress', async () => {
    const user = userEvent.setup();
    render(
      <TableHarness
        ticket={makeTicket({ finished: false, paid: 0, services_summary: 'Compresor' })}
      />,
    );

    expect(screen.queryByRole('link', { name: /terminar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^más acciones de R-0012$/i }));
    const terminar = await screen.findByRole('menuitem', { name: /^terminar R-0012$/i });
    expect(terminar.closest('a')).toHaveAttribute('href', '/tickets/12');
    expect(screen.queryByRole('menuitem', { name: /cobrar/i })).not.toBeInTheDocument();
  });

  it('offers Editar, not Terminar, in ⋯ when an in-progress ticket has no services', async () => {
    const user = userEvent.setup();
    render(
      <TableHarness
        ticket={makeTicket({ finished: false, paid: 0, services_summary: '  ' })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^más acciones de R-0012$/i }));
    const editar = await screen.findByRole('menuitem', { name: /^editar$/i });
    expect(editar.closest('a')).toHaveAttribute('href', '/tickets/12/edit');
    expect(screen.queryByRole('menuitem', { name: /terminar/i })).not.toBeInTheDocument();
  });

  it('leaves out the write actions when the user cannot write, and keeps the PDF', async () => {
    const user = userEvent.setup();
    render(<TableHarness ticket={makeTicket()} canWrite={false} />);

    await user.click(screen.getByRole('button', { name: /^más acciones de R-0012$/i }));
    expect(await screen.findByRole('menuitem', { name: /^descargar R-0012$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /cobrar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
