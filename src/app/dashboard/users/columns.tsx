'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { Company, Role, User } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UpdateUserDialog } from '@/app/dashboard/users/update-user-dialog';
import { DeleteUserDialog } from '@/app/dashboard/users/delete-user-dialog';
import { useState } from 'react';

type UserWithRelations = User & {
  company: Company | null;
  role: Role | null;
};

function CellActions({ user }: { user: UserWithRelations }) {
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

      <UpdateUserDialog
        user={user}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
      <DeleteUserDialog
        user={user}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}

export const columns: ColumnDef<UserWithRelations>[] = [
  {
    accessorKey: 'name',
    header: 'Nombre',
  },
  {
    accessorKey: 'email',
    header: 'Correo Electrónico',
  },
  {
    accessorKey: 'company.name',
    header: 'Empresa',
    cell: ({ row }) => {
      return row.original.company?.name ?? 'N/A';
    },
  },
  {
    accessorKey: 'role.name',
    header: 'Rol',
    cell: ({ row }) => {
      return row.original.role?.name ?? 'N/A';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellActions user={row.original} />,
  },
];
