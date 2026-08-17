import type { SortingState } from '@tanstack/react-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MobileSortSelectProps = {
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  options: Array<{ value: string; label: string }>;
  encodeSortingState: (sorting: SortingState) => string;
  decodeSortingState: (value: string) => SortingState;
  id: string;
  ariaLabel: string;
  layout: 'desktop' | 'sheet';
};

export const MobileSortSelect = ({
  sorting,
  onSortingChange,
  options,
  encodeSortingState,
  decodeSortingState,
  id,
  ariaLabel,
  layout,
}: MobileSortSelectProps) => {
  const sortValue = encodeSortingState(sorting);

  if (layout === 'desktop') {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Orden</p>
      <Select
        value={sortValue}
        onValueChange={(value) => onSortingChange(decodeSortingState(value))}
      >
        <SelectTrigger id={id} className="h-11 w-full rounded-xl" aria-label={ariaLabel}>
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
