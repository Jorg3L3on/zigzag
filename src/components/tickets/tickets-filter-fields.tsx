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
import { TICKET_PAYMENT_STATUS_LABEL } from '@/lib/ticket-payment-status';
import { cn } from '@/lib/utils';
import { formatDateRangeLabel } from '@/components/tickets/tickets-list-filter-utils';
import type {
  FinishedFilterValue,
  StatusFilterValue,
} from '@/components/tickets/tickets-list-types';

type FilterFieldLayout = 'desktop' | 'sheet';

const statusTriggerClass = (layout: FilterFieldLayout) =>
  layout === 'desktop'
    ? 'h-10 min-w-[12rem] max-w-[15rem] shrink-0'
    : 'h-11 w-full';

const finishedTriggerClass = (layout: FilterFieldLayout) =>
  layout === 'desktop'
    ? 'h-10 min-w-[11rem] max-w-[14rem] shrink-0'
    : 'h-11 w-full';

type TicketStatusFilterProps = {
  layout: FilterFieldLayout;
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
};

export const TicketStatusFilter = ({
  layout,
  value,
  onChange,
}: TicketStatusFilterProps) => {
  const id =
    layout === 'sheet' ? 'ticket-filter-status-sheet' : 'ticket-filter-status';

  const field = (
    <Select value={value} onValueChange={(next) => onChange(next as StatusFilterValue)}>
      <SelectTrigger
        id={id}
        className={statusTriggerClass(layout)}
        aria-label="Filtrar por pagado"
      >
        <SelectValue placeholder="¿Pagado?" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="due">Por cobrar (con saldo)</SelectItem>
        <SelectItem value="paid">{TICKET_PAYMENT_STATUS_LABEL.paid}</SelectItem>
        <SelectItem value="partial">
          {TICKET_PAYMENT_STATUS_LABEL.partial}
        </SelectItem>
        <SelectItem value="pending">
          {TICKET_PAYMENT_STATUS_LABEL.pending}
        </SelectItem>
      </SelectContent>
    </Select>
  );

  if (layout === 'desktop') {
    return field;
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-caption font-medium text-muted-foreground">
        ¿Pagado?
      </label>
      {field}
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

  const field = (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as FinishedFilterValue)}
    >
      <SelectTrigger
        id={id}
        className={finishedTriggerClass(layout)}
        aria-label="Filtrar por trabajo terminado"
      >
        <SelectValue placeholder="¿Terminado?" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="yes">Trabajo terminado</SelectItem>
        <SelectItem value="no">En proceso</SelectItem>
      </SelectContent>
    </Select>
  );

  if (layout === 'desktop') {
    return field;
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-caption font-medium text-muted-foreground">
        ¿Terminado?
      </label>
      {field}
    </div>
  );
};

type TicketDateRangeFilterProps = {
  layout: FilterFieldLayout;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
};

export const TicketDateRangeFilter = ({
  layout,
  value,
  onChange,
}: TicketDateRangeFilterProps) => {
  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        layout === 'desktop'
          ? 'h-10 min-w-[14rem] max-w-[17rem] shrink-0 justify-start text-left font-normal'
          : 'h-11 w-full justify-start text-left font-normal',
        !value?.from && 'text-muted-foreground',
      )}
      aria-label="Filtrar por rango de fechas del ticket"
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

  if (layout === 'desktop') {
    return calendar;
  }

  return (
    <div className="space-y-2">
      <span className="text-caption font-medium text-muted-foreground">
        Fechas
      </span>
      {calendar}
    </div>
  );
};
