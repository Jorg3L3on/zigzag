'use client';

import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type RoleActionsMenuProps = {
  label?: string;
  onEditRequest: () => void;
  onDeleteRequest: () => void;
};

export const RoleActionsMenu = ({
  label = 'Abrir menú',
  onEditRequest,
  onDeleteRequest,
}: RoleActionsMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="sr-only">{label}</span>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEditRequest();
          }}
        >
          <Pencil className="mr-2 h-4 w-4" aria-hidden />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-500 hover:text-red-500"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteRequest();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
