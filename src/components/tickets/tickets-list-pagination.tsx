import type { Table as ReactTable } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TicketsListPaginationProps<TData> = {
  table: ReactTable<TData>;
  /** Desktop footer: `1–25 de N tickets`, page size and the pager. Phone keeps the default. */
  variant?: 'phone' | 'desktop';
  totalCount?: number;
  /** What the desktop footer counts; Cobranza by client says «clientes» (ZIG-I31-3). */
  noun?: string;
};

const PageSizeSelect = <TData,>({ table }: { table: ReactTable<TData> }) => (
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
);

const PageButtons = <TData,>({ table }: { table: ReactTable<TData> }) => (
  <>
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-11 w-11"
      onClick={() => table.previousPage()}
      disabled={!table.getCanPreviousPage()}
      aria-label="Página anterior"
    >
      <ChevronLeft className="h-4 w-4" data-icon="inline-start"/>
    </Button>
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-11 w-11"
      onClick={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
      aria-label="Página siguiente"
    >
      <ChevronRight className="h-4 w-4" data-icon="inline-start"/>
    </Button>
  </>
);

export const TicketsListPagination = <TData,>({
  table,
  variant = 'phone',
  totalCount = 0,
  noun = 'tickets',
}: TicketsListPaginationProps<TData>) => {
  if (variant === 'desktop') {
    const { pageIndex, pageSize } = table.getState().pagination;
    const start = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
    const end = Math.min(totalCount, (pageIndex + 1) * pageSize);
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-1 py-3">
        <p className="text-sm tabular-nums text-muted-foreground">
          {`${start}\u2013${end} de ${totalCount} ${noun}`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PageSizeSelect table={table} />
          <div className="flex items-center gap-2">
            <PageButtons table={table} />
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 px-3 py-4 sm:flex-row sm:items-center sm:px-4">
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="min-w-0">Filas por página</span>
      <PageSizeSelect table={table} />
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
        <ChevronLeft className="h-4 w-4" data-icon="inline-start"/>
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
        <ChevronRight className="h-4 w-4" data-icon="inline-start"/>
      </Button>
    </div>
  </div>
  );
};
