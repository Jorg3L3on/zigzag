import type { Table as ReactTable } from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TicketsListPaginationProps = {
  table: ReactTable<Ticket>;
};

export const TicketsListPagination = ({ table }: TicketsListPaginationProps) => (
  <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 px-3 py-4 sm:flex-row sm:items-center sm:px-4">
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="min-w-0">Filas por página</span>
      <Select
        value={String(table.getState().pagination.pageSize)}
        onValueChange={(value) => {
          table.setPageSize(Number(value));
        }}
      >
        <SelectTrigger className="h-11 w-[5rem]" aria-label="Filas por página">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10</SelectItem>
          <SelectItem value="25">25</SelectItem>
          <SelectItem value="50">50</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[8rem] text-center text-sm tabular-nums text-muted-foreground">
        {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        aria-label="Página siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);
