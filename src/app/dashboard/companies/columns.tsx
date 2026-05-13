'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Company } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteCompanyDialog } from '@/app/dashboard/companies/delete-company-dialog';
import { useState } from 'react';
import Link from 'next/link';
import { formatCompanyAddressOneLine } from '@/lib/company-address';

const statusLabel = (status: Company['status']) =>
  status === 'ACTIVE' ? 'Activa' : 'Inactiva';

function CellActions({ company }: { company: Company }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menú</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/companies/${company.id}/edit`}
              className="flex cursor-pointer items-center"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-500 hover:text-red-500"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCompanyDialog
        company={company}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}

export const columns: ColumnDef<Company>[] = [
  {
    accessorKey: 'name',
    header: 'Nombre',
  },
  {
    accessorKey: 'email',
    header: 'Correo electrónico',
  },
  {
    accessorKey: 'phone',
    header: 'Teléfono',
  },
  {
    id: 'address',
    header: 'Dirección',
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[280px] text-sm">
        {formatCompanyAddressOneLine(row.original)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const active = row.original.status === 'ACTIVE';
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {statusLabel(row.original.status)}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellActions company={row.original} />,
  },
];
