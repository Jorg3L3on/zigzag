import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import { ListRowMenu } from '@/components/list-filter/list-desktop';
import { ListSortableHeader } from '@/components/list-page/list-sortable-header';
import { ListTable, ListTableCard } from '@/components/list-page/list-table';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

type Item = { id: number; name: string; total: number };

const items: Item[] = [
  { id: 1, name: 'Beto', total: 300 },
  { id: 2, name: 'Ana', total: 100 },
];

const Harness = ({
  onOpen,
  initialSorting = [],
}: {
  onOpen?: (item: Item) => void;
  initialSorting?: SortingState;
}) => {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const columns = React.useMemo<ColumnDef<Item>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <ListSortableHeader column={column} label="Cliente" />,
      },
      {
        accessorKey: 'total',
        meta: { align: 'right' },
        header: ({ column }) => <ListSortableHeader column={column} label="Total" align="right" />,
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <ListRowMenu
            label={`Acciones de ${row.original.name}`}
            items={[{ label: 'Editar', icon: null, onSelect: jest.fn() }]}
          />
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <ListTableCard footer={<p>pie</p>}>
      <ListTable
        table={table}
        ariaLabel="Clientes"
        rowTestId="row"
        onOpenRow={onOpen ? (row) => onOpen(row.original) : undefined}
      />
    </ListTableCard>
  );
};

describe('ListTable', () => {
  it('puts aria-sort on the th of sortable columns and follows the sorting state', () => {
    render(<Harness initialSorting={[{ id: 'total', desc: true }]} />);
    const [cliente, total, acciones] = screen.getAllByRole('columnheader');
    expect(cliente).toHaveAttribute('aria-sort', 'none');
    expect(total).toHaveAttribute('aria-sort', 'descending');
    expect(acciones).not.toHaveAttribute('aria-sort');
    // aria-sort lives on the th, never on the button inside it.
    expect(within(total).getByRole('button')).not.toHaveAttribute('aria-sort');

    fireEvent.click(within(cliente).getByRole('button', { name: /Cliente/ }));
    expect(cliente).toHaveAttribute('aria-sort', 'ascending');
    expect(total).toHaveAttribute('aria-sort', 'none');
    expect(screen.getAllByTestId('row')[0]).toHaveTextContent('Ana');
  });

  it('right-aligns numeric columns in the th and the td, with tabular figures', () => {
    render(<Harness />);
    expect(screen.getAllByRole('columnheader')[1].className).toContain('text-right');
    const cell = within(screen.getAllByTestId('row')[0]).getAllByRole('cell')[1];
    expect(cell.className).toContain('text-right');
    expect(cell.className).toContain('tabular-nums');
  });

  it('uses the shared recipe with a sticky header on the opaque list-head band', () => {
    render(<Harness />);
    const table = screen.getByRole('table', { name: 'Clientes' });
    expect(table.className).toContain('[&_th]:bg-list-head');
    expect(table.className).toContain('[&_th]:px-3');
    const thead = table.querySelector('thead');
    expect(thead?.className).toContain('sticky');
    expect(thead?.className).toContain('top-16');
    expect(thead?.className).toContain('bg-list-head');
  });

  it('opens a row by click, Enter and Space, but not from its ⋯ menu', () => {
    const onOpen = jest.fn();
    render(<Harness onOpen={onOpen} />);
    const row = screen.getAllByTestId('row')[0];
    expect(row).toHaveAttribute('tabindex', '0');

    fireEvent.click(within(row).getAllByRole('cell')[0]);
    expect(onOpen).toHaveBeenLastCalledWith(items[0]);

    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(3);

    const menu = within(row).getByRole('button', { name: 'Acciones de Beto' });
    fireEvent.click(menu);
    fireEvent.keyDown(menu, { key: 'Enter' });
    fireEvent.keyDown(menu, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('dims the rows and marks the table busy while it refreshes', () => {
    const Busy = () => {
      const table = useReactTable({
        data: items,
        columns: [{ accessorKey: 'name', header: 'Cliente' }],
        getCoreRowModel: getCoreRowModel(),
      });
      return <ListTable table={table} ariaLabel="Clientes" busy />;
    };
    render(<Busy />);
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-busy', 'true');
    expect(table.className).toContain('opacity-60');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});
