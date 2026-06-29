import type { SortingState } from '@tanstack/react-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TICKETS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/tickets/tickets-sort-presets';

type TicketsSortControlsProps = {
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  id?: string;
  className?: string;
  triggerClassName?: string;
};

export const TicketsSortControls = ({
  sorting,
  onSortingChange,
  id = 'ticket-sort',
  className,
  triggerClassName = 'h-11 w-full',
}: TicketsSortControlsProps) => {
  const mobileSortValue = encodeSortingState(sorting);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        Ordenar por
      </label>
      <Select
        value={mobileSortValue}
        onValueChange={(value) => onSortingChange(decodeSortingState(value))}
      >
        <SelectTrigger
          id={id}
          className={triggerClassName}
          aria-label="Ordenar lista de tickets"
        >
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          {TICKETS_MOBILE_SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
