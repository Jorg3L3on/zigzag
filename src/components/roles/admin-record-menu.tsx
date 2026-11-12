'use client';

import { MoreHorizontal } from 'lucide-react';

import type { ListRowMenuItem } from '@/components/list-page';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The ⋯ on the phone cards of the system admin lists (Roles, Usuarios, Permisos).
 * Phones look exactly as before ZIG-I33, so it keeps the old trigger; desktop rows use
 * `ListRowMenu`. Pointer, click and keys stop here (the menu is portalled, but React
 * events still bubble): before ZIG-I33 a tap on the ⋯ also opened the edit dialog.
 */
export const AdminRecordMenu = ({
  label = 'Abrir menú',
  items,
}: {
  label?: string;
  items: ListRowMenuItem[];
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        className="h-8 w-8 p-0"
        aria-label={label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span className="sr-only">{label}</span>
        <MoreHorizontal className="h-4 w-4" aria-hidden data-icon="inline-start" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {items.map((item) => (
        <DropdownMenuItem
          key={item.label}
          className={item.destructive ? 'text-red-500 hover:text-red-500' : undefined}
          onClick={(event) => {
            event.stopPropagation();
            item.onSelect();
          }}
        >
          {item.icon}
          {item.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
