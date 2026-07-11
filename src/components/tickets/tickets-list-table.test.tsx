import { render, screen } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TicketsListTable } from '@/components/tickets/tickets-list-table';

jest.mock('@/components/tickets/tickets-list-row', () => ({
  TicketsListRow: ({ row }: { row: { original: Ticket } }) => (
    <tr data-testid="ticket-row">
      <td>{row.original.client_name}</td>
    </tr>
  ),
}));

const ticket: Ticket = {
  id: BigInt(3),
  client_id: 1,
  client_name: 'Cliente Gamma',
  client_tel: '5551111111',
  email: null,
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 80,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
};

const columns: ColumnDef<Ticket>[] = [
  { accessorKey: 'client_name', header: 'Cliente' },
];

const TableHarness = () => {
  const table = useReactTable({
    data: [ticket],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <TicketsListTable table={table} canWrite />;
};

describe('TicketsListTable', () => {
  it('renders column headers and delegated rows', () => {
    render(<TableHarness />);

    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-row')).toHaveTextContent('Cliente Gamma');
  });
});
