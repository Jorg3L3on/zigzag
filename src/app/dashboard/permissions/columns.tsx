'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Company } from '@/db/schema';
import { UpdatePermissionDialog } from '@/app/dashboard/permissions/update-permission-dialog';
import { DeletePermissionDialog } from '@/app/dashboard/permissions/delete-permission-dialog';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type Permission = {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  company: Company | null;
};

function PermissionActions({ permission }: { permission: Permission }) {
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
          <DropdownMenuItem onClick={() => setIsUpdateDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-500 hover:text-red-500"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UpdatePermissionDialog
        permission={permission}
        open={isUpdateDialogOpen}
        onOpenChange={setIsUpdateDialogOpen}
      />
      <DeletePermissionDialog
        permission={permission}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}

export const columns: ColumnDef<Permission>[] = [
  {
    accessorKey: 'name',
    header: 'Nombre',
  },
  {
    accessorKey: 'company.name',
    header: 'Empresa',
    cell: ({ row }) => {
      return row.original.company?.name ?? 'N/A';
    },
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
  },
  {
    id: 'actions',
    cell: ({ row }) => <PermissionActions permission={row.original} />,
  },
];
