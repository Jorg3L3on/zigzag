'use client';

import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { LIST_SORTABLE_HEADER_CLASS } from '@/components/list-page/list-desktop';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The only way to sort a desktop list (ZIG-I33 §3): a header button that toggles the
 * column. `ListTable` puts `aria-sort` on the th; with `manualSorting` the page sends
 * the sorting state to the server.
 */
export const ListSortableHeader = <TData,>({
  column,
  label,
  align,
  className,
}: {
  column: Column<TData, unknown>;
  label: string;
  align?: 'right';
  className?: string;
}) => {
  const sorted = column.getIsSorted();
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        LIST_SORTABLE_HEADER_CLASS,
        align === 'right' && 'ml-0 -mr-1.5',
        className,
      )}
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'desc' ? (
        <ArrowDown className="size-3 shrink-0" aria-hidden />
      ) : sorted === 'asc' ? (
        <ArrowUp className="size-3 shrink-0" aria-hidden />
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-60" aria-hidden />
      )}
    </Button>
  );
};
