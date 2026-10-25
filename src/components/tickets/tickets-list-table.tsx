import { flexRender, type Table as ReactTable } from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TicketsListRow } from '@/components/tickets/tickets-list-row';
import {
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
  <div className="hidden md:block">
    <table
      className={
        // 56px rows, fixed to the card so ⋮ stays on screen at 1024 with the sidebar open.
        'w-full table-fixed caption-bottom border-collapse text-sm [&_td]:h-14 [&_td]:px-3 [&_td]:py-0 [&_td]:align-middle [&_th]:h-10 [&_th]:bg-background [&_th]:px-3 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
      }
    >
      <TableHeader className="sticky top-16 z-20 bg-background">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
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
    </table>
  </div>
);
