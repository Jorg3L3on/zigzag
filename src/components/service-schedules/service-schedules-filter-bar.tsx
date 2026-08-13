import type { ScheduleFilterBucket } from '@/lib/schedule-buckets';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-filter';

const FILTER_OPTIONS: Array<{ value: ScheduleFilterBucket; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'proximos', label: 'Próximos' },
  { value: 'atrasados', label: 'Atrasados' },
  { value: 'programados', label: 'Programados' },
  { value: 'pausados', label: 'Pausados' },
];

type ServiceSchedulesFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filter: ScheduleFilterBucket;
  onFilterChange: (value: ScheduleFilterBucket) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderBucketFilter = (
  filter: ScheduleFilterBucket,
  onFilterChange: (value: ScheduleFilterBucket) => void,
  layout: 'desktop' | 'sheet',
) => (
  <ButtonFilterGroup
    label="Estado"
    options={FILTER_OPTIONS}
    value={filter}
    onChange={onFilterChange}
    layout={layout}
    getOptionAriaLabel={(_label, optionLabel) => `Filtrar ${optionLabel}`}
  />
);

export const ServiceSchedulesFilterBar = ({
  searchValue,
  onSearchChange,
  filter,
  onFilterChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: ServiceSchedulesFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por cliente o servicio"
    searchAriaLabel="Buscar recordatorios"
    searchClassName="min-h-11 rounded-xl pl-9"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Estado del recordatorio."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de recordatorios"
    filterChips={filterChips}
    sheetContent={renderBucketFilter(filter, onFilterChange, 'sheet')}
    desktopContent={renderBucketFilter(filter, onFilterChange, 'desktop')}
  />
);
