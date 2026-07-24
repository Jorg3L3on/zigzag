'use client';

/**
 * Generic table-only helper — **not** for dashboard resource lists.
 * Dashboard lists must use the `*List` + `*-columns.tsx` pattern with TanStack
 * desktop tables and `md:hidden` mobile cards from `table.getRowModel().rows`.
 * See `.cursor/rules/lists-and-responsive-tables.mdc`.
 */

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getFilteredRowModel,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, TableProperties } from 'lucide-react';
import { TripledEmptyState } from '@/components/tripled/empty-state';

/**
 * Do not use for dashboard lists — use resource `*List` pattern with mobile cards.
 */
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterColumnId?: string;
  filterPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumnId,
  filterPlaceholder = 'Buscar...',
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (filterColumnId) {
                table.getColumn(filterColumnId)?.setFilterValue(value);
                return;
              }
              setGlobalFilter(value);
            }}
            placeholder={filterPlaceholder}
            className="pl-9"
            aria-label={filterPlaceholder || 'Buscar'}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {table.getRowModel().rows.length} resultados
        </p>
      </div>

      {table.getRowModel().rows.length === 0 ? (
        <TripledEmptyState
          icon={<TableProperties className="h-4 w-4" />}
          title="Sin resultados"
          description="Ajusta los filtros para ver información."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
