import type { KeyboardEvent } from 'react';
import { flexRender, type Row } from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TableCell, TableRow } from '@/components/ui/table';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import { useRouter } from 'next/navigation';

type TicketsListRowProps = {
  row: Row<Ticket>;
  canWrite: boolean;
};

export const TicketsListRow = ({ row, canWrite }: TicketsListRowProps) => {
  const router = useRouter();

  const handleNavigate = () => {
    router.push(hrefForTicketListRow(row.original, canWrite));
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(hrefForTicketListRow(row.original, canWrite));
    }
  };

  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
};
