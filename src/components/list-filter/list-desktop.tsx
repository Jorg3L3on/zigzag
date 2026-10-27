'use client';

import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';

import { DesktopSwitch } from '@/components/desktop-switch';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter/filter-styles';
import { cn } from '@/lib/utils';

/*
 * The desktop pieces of the catalog lists (Clientes, Servicios), in the language of
 * Tickets and Cobranza (ZIG-30): a title row with the count, one filter row, the
 * Cobranza table with 11 px uppercase headers and a ⋯ menu per row.
 */

export const LIST_SORTABLE_HEADER_CLASS =
  '-ml-1.5 h-7 max-w-full gap-1 px-1.5 md:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-transparent hover:text-foreground';

/** «8 oct», with the year only when it is not this one, like the tickets list. */
export const ListShortDate = ({ date }: { date: Date | null | undefined }) => {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const value = new Date(date);
  const pattern = value.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy';
  return (
    <span
      className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300"
      title={format(value, 'PPP', { locale: es })}
    >
      {format(value, pattern, { locale: es })}
    </span>
  );
};

type ListDesktopTitleProps = {
  title: string;
  /** Shown as «Clientes · 23» once the list has loaded. */
  count?: number | null;
  description: string;
  actions?: ReactNode;
};

/** The page title from lg; phones keep the card header. */
export const ListDesktopTitle = ({ title, count, description, actions }: ListDesktopTitleProps) => (
  <DesktopSwitch
    phone={null}
    desktop={
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {title}
            {count != null ? (
              <span className="font-normal text-muted-foreground">
                {' · '}
                <span className="tabular-nums">{count}</span>
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    }
  />
);

type ListFilterSelectProps<TValue extends string> = {
  value: TValue;
  /** The value that means «no filter»; any other one gets the selected tint. */
  allValue: TValue;
  onChange: (value: TValue) => void;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  ariaLabel: string;
  className?: string;
};

/** A pill select for the desktop filter row, like Recordatorios. */
export const ListFilterSelect = <TValue extends string>({
  value,
  allValue,
  onChange,
  options,
  ariaLabel,
  className,
}: ListFilterSelectProps<TValue>) => (
  <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
    <SelectTrigger
      className={cn(
        'h-11 w-auto min-w-[168px] rounded-full',
        value !== allValue && FILTER_SELECTED_CLASS,
        className,
      )}
      aria-label={ariaLabel}
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export type ListRowMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
};

/** The ⋯ menu at the end of a desktop row; clicks never reach the row. */
export const ListRowMenu = ({ label, items }: { label: string; items: ListRowMenuItem[] }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
      {items.map((item) => (
        <DropdownMenuItem
          key={item.label}
          className={cn(item.destructive && 'text-destructive focus:text-destructive')}
          onSelect={item.onSelect}
        >
          {item.icon}
          {item.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
