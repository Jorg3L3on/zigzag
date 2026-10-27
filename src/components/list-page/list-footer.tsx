'use client';

import type { ReactNode } from 'react';
import type { Table as ReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** 25 rows a page in every desktop list (ZIG-I33 §7). */
export const LIST_PAGE_SIZE = 25;
export const LIST_PAGE_SIZES = [10, 25, 50] as const;

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

export type ListFooterPagination = {
  /** Zero-based. */
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  /** Server pagination: shows «Por página» 10 / 25 / 50. */
  onPageSizeChange?: (pageSize: number) => void;
};

/** The pager state of a TanStack table (client or manual pagination). */
export const listFooterPagination = <TData,>(
  table: ReactTable<TData>,
  { pageSizes = true }: { pageSizes?: boolean } = {},
): ListFooterPagination => {
  const { pageIndex, pageSize } = table.getState().pagination;
  return {
    pageIndex,
    pageSize,
    pageCount: table.getPageCount(),
    onPageChange: (next) => table.setPageIndex(next),
    onPageSizeChange: pageSizes ? (next) => table.setPageSize(next) : undefined,
  };
};

type ListFooterProps = {
  /** Every row the list has under the current filters. */
  total: number;
  /** What it counts, plural: «tickets», «personas». */
  noun: string;
  /** Without a pager: how many rows are shown («8 de 12 personas»); defaults to total. */
  shown?: number;
  pagination?: ListFooterPagination;
  /** A second line on the left: «· suman $…», the En proceso note. */
  extra?: ReactNode;
  /** Replaces the count, e.g. «40 eventos cargados». */
  label?: ReactNode;
  /** Cursor lists (Auditoría, Actividad) load more instead of paging. */
  loadMore?: { onLoadMore: () => void; hasMore: boolean; loading?: boolean; label?: string };
};

/**
 * The footer inside a list card (ZIG-I33 §7): «1–25 de N tickets» on the left, the
 * numbered pager on the right only when there is more than one page, with «Por
 * página» for server pagination; or «Cargar más» for cursor lists.
 */
export const ListFooter = ({
  total,
  noun,
  shown,
  pagination,
  extra,
  label,
  loadMore,
}: ListFooterProps) => {
  const paged = pagination != null && pagination.pageCount > 1;
  let count: ReactNode = label;
  if (count == null) {
    if (paged) {
      const { pageIndex, pageSize } = pagination;
      const start = total === 0 ? 0 : pageIndex * pageSize + 1;
      const end = Math.min(total, (pageIndex + 1) * pageSize);
      count = `${start}–${end} de ${total} ${noun}`;
    } else {
      count = `${shown ?? total} de ${total} ${noun}`;
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-4 py-3 text-sm text-muted-foreground"
      data-testid="list-footer"
    >
      <div className="min-w-0">
        <p className="tabular-nums">{count}</p>
        {extra ? <div className="mt-0.5">{extra}</div> : null}
      </div>
      {paged ? <ListPager pagination={pagination} /> : null}
      {loadMore?.hasMore ? (
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={loadMore.onLoadMore}
          disabled={loadMore.loading}
        >
          {loadMore.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loadMore.label ?? 'Cargar más'}
        </Button>
      ) : null}
    </div>
  );
};

const ListPager = ({ pagination }: { pagination: ListFooterPagination }) => {
  const { pageIndex, pageSize, pageCount, onPageChange, onPageSizeChange } = pagination;
  const current = pageIndex + 1;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center gap-1.5">
      {onPageSizeChange ? (
        <>
          <span className="mr-1.5">Por página</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="w-2" aria-hidden />
        </>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => onPageChange(pageIndex - 1)}
        disabled={current <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      {pagerPages(current, pageCount).map((page, index) =>
        page === 'gap' ? (
          <span key={`gap-${index}`} className="px-1" aria-hidden>
            …
          </span>
        ) : (
          <Button
            key={page}
            type="button"
            variant={page === current ? 'secondary' : 'ghost'}
            className="h-9 min-w-9 px-2 tabular-nums"
            aria-current={page === current ? 'page' : undefined}
            aria-label={`Página ${page}`}
            onClick={() => onPageChange(page - 1)}
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
        onClick={() => onPageChange(pageIndex + 1)}
        disabled={current >= pageCount}
        aria-label="Página siguiente"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
};
