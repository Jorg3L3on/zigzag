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
  /** What the desktop footer counts; presupuestos reuse it (ZIG-I29-3). */
  noun?: string;
  /** Desktop, one page only: a line on the right instead of the pager («Orden: …»). */
  note?: string;
};

/** Page numbers around the current one, with gaps: 1 … 4 5 6 … 12. */
export const pagerPages = (current: number, count: number): Array<number | 'gap'> => {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push('gap');
    out.push(page);
  });
  return out;
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

export const TicketsListPagination = <TData,>({
  table,
  variant = 'phone',
  totalCount = 0,
  noun = 'tickets',
  note,
}: TicketsListPaginationProps<TData>) => {
  if (variant === 'desktop') {
    // Canvas ListaA / ListaPresuA: «1–25 de 60 tickets» and Por página with ‹ 1 2 3 ›;
    // a single page reads «6 de 6 presupuestos» and can carry a note instead.
    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();
    const start = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
    const end = Math.min(totalCount, (pageIndex + 1) * pageSize);
    const single = pageCount <= 1;
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-1 py-3 text-caption text-muted-foreground">
        <p className="tabular-nums">
          {single ? `${totalCount} de ${totalCount} ${noun}` : `${start}\u2013${end} de ${totalCount} ${noun}`}
        </p>
        {single && note ? (
          <p>{note}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1.5">Por página</span>
            <PageSizeSelect table={table} />
            <span className="w-2" aria-hidden />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            {pagerPages(pageIndex + 1, Math.max(pageCount, 1)).map((page, index) =>
              page === 'gap' ? (
                <span key={`gap-${index}`} className="px-1" aria-hidden>
                  …
                </span>
              ) : (
                <Button
                  key={page}
                  type="button"
                  variant={page === pageIndex + 1 ? 'secondary' : 'ghost'}
                  className="h-9 min-w-9 px-2 tabular-nums"
                  aria-current={page === pageIndex + 1 ? 'page' : undefined}
                  aria-label={`Página ${page}`}
                  onClick={() => table.setPageIndex(page - 1)}
                >
                  {page}
                </Button>
              ),
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
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
