'use client';

import type { ReactNode } from 'react';
import {
  flexRender,
  type Header,
  type Row,
  type Table as ReactTable,
} from '@tanstack/react-table';

import { ListClickableRow } from '@/components/list-page/list-clickable-row';
import {
  LIST_TABLE_CARD_CLASS,
  LIST_TABLE_CLASS,
  LIST_TABLE_DENSE_PADDING_CLASS,
  LIST_TABLE_PADDING_CLASS,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ariaSort = <TData,>(header: Header<TData, unknown>) => {
  if (header.isPlaceholder || !header.column.getCanSort()) return undefined;
  const sorted = header.column.getIsSorted();
  return sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
};

/** Header and cell classes from the column meta: its className, plus right-aligned figures. */
export const listColumnClassName = (meta: { className?: string; align?: 'right' } | undefined) =>
  cn(meta?.className, meta?.align === 'right' && 'text-right tabular-nums');

type ListTableProps<TData> = {
  table: ReactTable<TData>;
  ariaLabel: string;
  /** 6 px per side instead of 12 (Cobranza). */
  dense?: boolean;
  /** Refreshing (filter, page, sort): the rows stay, dimmed, never the skeleton (ZIG-I33 §8). */
  busy?: boolean;
  /** Where the header sticks: under the app bar (default) or at the top of a scroll area. */
  stickyTop?: 'top-16' | 'top-0';
  /** Opens the row's element (detail, edit, side panel) by click, Enter or Space. */
  onOpenRow?: (row: Row<TData>) => void;
  /** Or a route to push. */
  getRowHref?: (row: Row<TData>) => string;
  /** The open or selected row, drawn as `data-state=selected`. */
  isRowSelected?: (row: Row<TData>) => boolean;
  rowTestId?: string;
  /** Replaces the default row (cells from the column defs) when a page needs more. */
  renderRow?: (row: Row<TData>) => ReactNode;
  className?: string;
};

/**
 * The desktop list table (ZIG-I33 §4): `LIST_TABLE_CLASS`, a sticky header on the
 * list-head band with `aria-sort` on each sortable th, and keyboard rows. Put it in
 * `ListTableCard`; the card's footer carries the counts and the pager.
 */
export const ListTable = <TData,>({
  table,
  ariaLabel,
  dense = false,
  busy = false,
  stickyTop = 'top-16',
  onOpenRow,
  getRowHref,
  isRowSelected,
  rowTestId,
  renderRow,
  className,
}: ListTableProps<TData>) => (
  <table
    className={cn(
      LIST_TABLE_CLASS,
      dense ? LIST_TABLE_DENSE_PADDING_CLASS : LIST_TABLE_PADDING_CLASS,
      'transition-opacity',
      busy && 'opacity-60',
      className,
    )}
    aria-label={ariaLabel}
    aria-busy={busy || undefined}
  >
    <TableHeader className={cn('sticky z-20 bg-list-head', stickyTop)}>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className="hover:bg-transparent">
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              aria-sort={ariaSort(header)}
              className={listColumnClassName(header.column.columnDef.meta)}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.map((row) =>
        renderRow ? (
          renderRow(row)
        ) : (
          <ListClickableRow
            key={row.id}
            data-testid={rowTestId}
            selected={isRowSelected?.(row)}
            onOpen={onOpenRow ? () => onOpenRow(row) : undefined}
            href={getRowHref?.(row)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className={listColumnClassName(cell.column.columnDef.meta)}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </ListClickableRow>
        ),
      )}
    </TableBody>
  </table>
);

/** The card around a list table (ZIG-I33 §4), with the footer inside. */
export const ListTableCard = ({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) => (
  <div className={cn(LIST_TABLE_CARD_CLASS, className)}>
    {children}
    {footer}
  </div>
);
