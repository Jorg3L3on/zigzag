'use client';

import { ColumnDef, Row } from '@tanstack/react-table';
import CellAction from '@/components/clients/cell-action';

export type ClientColumn = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  created_at: Date;
};

export const columns: ColumnDef<ClientColumn>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
  },
  {
    accessorKey: 'document',
    header: 'Document',
  },
  {
    accessorKey: 'address',
    header: 'Address',
  },
  {
    id: 'actions',
    cell: ({ row }: { row: Row<ClientColumn> }) => (
      <CellAction data={row.original} />
    ),
  },
];
