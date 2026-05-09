'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Company, Permission } from '@/db/schema';
import { UpdateRoleDialog } from './update-role-dialog';
import { DeleteRoleDialog } from './delete-role-dialog';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export type Role = {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  company: Company | null;
  permissions: {
    permission: Permission | null;
  }[];
};

function RoleActions({ role }: { role: Role }) {
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
      <UpdateRoleDialog
        role={role}
        open={isUpdateDialogOpen}
        onOpenChange={setIsUpdateDialogOpen}
      />
      <DeleteRoleDialog
        role={role}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}

export const columns: ColumnDef<Role>[] = [
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
    accessorKey: 'permissions',
    header: 'Permisos',
    cell: ({ row }) => {
      return (
        <div className="flex flex-wrap gap-1">
          {row.original.permissions.map(({ permission }) =>
            permission ? (
              <Badge key={permission.id} variant="secondary">
                {permission.name}
              </Badge>
            ) : null,
          )}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <RoleActions role={row.original} />,
  },
];
