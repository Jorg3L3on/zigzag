import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TicketsListPagination } from '@/components/tickets/tickets-list-pagination';

const makeTicket = (id: number): Ticket => ({
  id: BigInt(id),
  client_id: 1,
  client_name: `Cliente ${id}`,
  client_tel: '5550000000',
  email: null,
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 100,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
});

const columns: ColumnDef<Ticket>[] = [
  { accessorKey: 'client_name', header: 'Cliente' },
];

const PaginationHarness = ({
  pageSize = 10,
  variant = 'phone',
  totalCount,
}: {
  pageSize?: number;
  variant?: 'phone' | 'desktop';
  totalCount?: number;
}) => {
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const table = useReactTable({
    data: Array.from({ length: 15 }, (_, index) => makeTicket(index + 1)),
    columns,
    state: { pagination },
    onPaginationChange: (updater) => {
      setPagination((current) =>
        typeof updater === 'function' ? updater(current) : updater,
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <TicketsListPagination table={table} variant={variant} totalCount={totalCount} />;
};

describe('TicketsListPagination', () => {
  it('renders page size control and page navigation labels', () => {
    render(<PaginationHarness />);

    expect(screen.getByLabelText(/filas por página/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /página anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /página siguiente/i })).toBeEnabled();
    expect(
      screen.getByText((_, element) =>
        Boolean(
          element?.classList.contains('tabular-nums') &&
            element.textContent?.replace(/\s+/g, ' ').trim() === '1 / 2',
        ),
      ),
    ).toBeInTheDocument();
  });

  it('shows the desktop range, page size and pager (ZIG-I28-4)', () => {
    render(<PaginationHarness variant="desktop" totalCount={40} pageSize={10} />);

    expect(screen.getByText('1\u201310 de 40 tickets')).toBeInTheDocument();
    expect(screen.getByLabelText(/filas por página/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /página anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /página siguiente/i })).toBeEnabled();
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();
  });
});
