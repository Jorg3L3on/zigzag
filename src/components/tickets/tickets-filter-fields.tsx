import type * as React from 'react';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateRangeLabel } from '@/components/tickets/tickets-list-filter-utils';
import type { FinishedFilterValue } from '@/components/tickets/tickets-list-types';

type FilterFieldLayout = 'desktop' | 'sheet';

/**
 * Desktop controls match the Cobro chips: same 44px height, pill radius and text size,
 * fixed widths so the two never wrap onto separate rows (ZIG-I27-3).
 */
const DESKTOP_CONTROL_CLASS = 'h-11 shrink-0 rounded-full px-4 text-base md:h-11';

/** The caption above each control: the sheet always had one, desktop now too (ZIG-I27-3). */
const FilterField = ({
  label,
  htmlFor,
  layout,
  children,
}: {
  label: string;
  htmlFor?: string;
  layout: FilterFieldLayout;
  children: React.ReactNode;
}) => {
  const Caption = htmlFor ? 'label' : 'span';
  return (
    <div className={layout === 'desktop' ? 'flex flex-col gap-1.5' : 'space-y-2'}>
      <Caption htmlFor={htmlFor} className="text-caption font-medium text-muted-foreground">
        {label}
      </Caption>
      {children}
    </div>
  );
};

type TicketFinishedFilterProps = {
  layout: FilterFieldLayout;
  value: FinishedFilterValue;
  onChange: (value: FinishedFilterValue) => void;
};

export const TicketFinishedFilter = ({
  layout,
  value,
  onChange,
}: TicketFinishedFilterProps) => {
  const id =
    layout === 'sheet' ? 'ticket-filter-finished-sheet' : 'ticket-filter-finished';

  return (
    <FilterField label="Trabajo" htmlFor={id} layout={layout}>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as FinishedFilterValue)}
      >
        <SelectTrigger
          id={id}
          className={layout === 'desktop' ? cn(DESKTOP_CONTROL_CLASS, 'w-56') : 'h-11 w-full'}
        >
          <SelectValue placeholder="Todos los trabajos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los trabajos</SelectItem>
          <SelectItem value="yes">Terminados</SelectItem>
          <SelectItem value="no">En proceso</SelectItem>
        </SelectContent>
      </Select>
    </FilterField>
  );
};

type TicketDateRangeFilterProps = {
  layout: FilterFieldLayout;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  /** Presupuestos filter by issue date (ZIG-I29-3). */
  ariaLabel?: string;
};

export const TicketDateRangeFilter = ({
  layout,
  value,
  onChange,
  ariaLabel = 'Filtrar por rango de fechas del ticket',
}: TicketDateRangeFilterProps) => {
  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        layout === 'desktop'
          ? // As wide as its label (canvas «Todas las fechas»), up to 16rem for a range.
            cn(DESKTOP_CONTROL_CLASS, 'w-auto max-w-64 justify-start text-left font-normal')
          : 'h-11 w-full justify-start text-left font-normal',
        !value?.from && 'text-muted-foreground',
      )}
      aria-label={ariaLabel}
    >
      <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-70" data-icon="inline-start"/>
      <span className="truncate">{formatDateRangeLabel(value)}</span>
    </Button>
  );

  const calendar = (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={layout === 'desktop' ? 'start' : 'center'}
      >
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={layout === 'desktop' ? 2 : 1}
          initialFocus
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size={layout === 'desktop' ? 'sm' : 'default'}
            className={layout === 'sheet' ? 'min-h-11 w-full' : 'w-full'}
            onClick={() => onChange(undefined)}
            aria-label="Limpiar rango de fechas"
          >
            Limpiar fechas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Desktop bar (canvas ListaA): «Todas las fechas» says what it is; the sheet keeps its label.
  if (layout === 'desktop') return calendar;
  return (
    <FilterField label="Fechas" layout={layout}>
      {calendar}
    </FilterField>
  );
};
