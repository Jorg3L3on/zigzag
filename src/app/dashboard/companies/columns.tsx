'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Company } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UpdateCompanyDialog } from '@/app/dashboard/companies/update-company-dialog';
import { DeleteCompanyDialog } from '@/app/dashboard/companies/delete-company-dialog';
import { useState } from 'react';

function CellActions({ company }: { company: Company }) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
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
          <DropdownMenuItem onClick={() => setShowUpdateDialog(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
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

      <UpdateCompanyDialog
        company={company}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
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
    header: 'Correo Electrónico',
  },
  {
    accessorKey: 'phone',
    header: 'Teléfono',
  },
  {
    accessorKey: 'address',
    header: 'Dirección',
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellActions company={row.original} />,
  },
];
