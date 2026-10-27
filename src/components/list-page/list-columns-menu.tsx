'use client';

import * as React from 'react';
import type { Table as ReactTable } from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ListColumnOption = { id: string; label: string };

const readHidden = (storageKey: string): string[] => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * The columns the person hid on a desktop list, remembered in this browser
 * (canvas «Columnas»). Returns a tanstack visibility map to merge into state.
 */
export const useListHiddenColumns = (storageKey: string) => {
  const [hidden, setHidden] = React.useState<string[]>([]);

  React.useEffect(() => {
    setHidden(readHidden(storageKey));
  }, [storageKey]);

  const toggle = React.useCallback(
    (id: string, visible: boolean) => {
      setHidden((current) => {
        const next = visible ? current.filter((value) => value !== id) : [...new Set([...current, id])];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Private windows: the choice lasts until reload.
        }
        return next;
      });
    },
    [storageKey],
  );

  const visibility = React.useMemo(
    () => Object.fromEntries(hidden.map((id) => [id, false])) as Record<string, boolean>,
    [hidden],
  );

  return { hidden, toggle, visibility };
};

/**
 * Columnas (canvas ListaA / ListaPresuA): a checkbox per optional column. A
 * column the page is too narrow for stays hidden even when checked.
 */
export const ListColumnsMenu = <TData,>({
  table,
  options,
  onToggle,
}: {
  table: ReactTable<TData>;
  options: ListColumnOption[];
  onToggle: (id: string, visible: boolean) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" className="h-11 shrink-0 gap-2 rounded-full px-4" aria-label="Elegir columnas">
        <Columns3 className="h-4 w-4" aria-hidden />
        Columnas
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {options.map((option) => {
        const column = table.getColumn(option.id);
        if (!column) return null;
        return (
          <DropdownMenuCheckboxItem
            key={option.id}
            className="min-h-11"
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => onToggle(option.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
