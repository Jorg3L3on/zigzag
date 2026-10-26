'use client';

import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { flexRender, type Row, type Table as ReactTable } from '@tanstack/react-table';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CobranzaRow } from '@/lib/cobranza';

/** 56 px rows and a fixed layout, like the tickets table (ZIG-I28-4). */
export const COBRANZA_TABLE_CLASS =
  'w-full table-fixed caption-bottom border-collapse text-sm [&_td]:h-14 [&_td]:px-3 [&_td]:py-0 [&_td]:align-middle [&_th]:h-10 [&_th]:bg-background [&_th]:px-3 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60';

const CobranzaTicketRow = ({ row }: { row: Row<CobranzaRow> }) => {
  const router = useRouter();
  const href = `/tickets/${row.original.id}`;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <TableRow
      className="group h-14 cursor-pointer"
      tabIndex={0}
      data-testid="cobranza-row"
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
};

export const CobranzaTicketTable = ({ table }: { table: ReactTable<CobranzaRow> }) => (
  <table className={COBRANZA_TABLE_CLASS} aria-label="Tickets por cobrar">
    <TableHeader className="sticky top-16 z-20 bg-background">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.map((row) => (
        <CobranzaTicketRow key={row.id} row={row} />
      ))}
    </TableBody>
  </table>
);
