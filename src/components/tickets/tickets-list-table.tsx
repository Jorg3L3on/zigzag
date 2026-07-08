import { flexRender, type Table as ReactTable } from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TicketsListRow } from '@/components/tickets/tickets-list-row';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TicketsListTableProps = {
  table: ReactTable<Ticket>;
  canWrite: boolean;
};

export const TicketsListTable = ({ table, canWrite }: TicketsListTableProps) => (
  <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
    <Table
      className={
        '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
      }
    >
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TicketsListRow key={row.id} row={row} canWrite={canWrite} />
        ))}
      </TableBody>
    </Table>
  </div>
);
