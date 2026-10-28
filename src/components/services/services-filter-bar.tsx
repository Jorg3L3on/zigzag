import type { SortingState } from '@tanstack/react-table';
import type { ServiceStatusFilter } from '@/actions/services';
import {
  SERVICES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/services/services-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterSelect,
  ListToolbar,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-page';

const STATUS_OPTIONS: Array<{ value: ServiceStatusFilter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'deleted', label: 'Eliminados' },
  { value: 'all', label: 'Todos' },
];

type ServicesFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: ServiceStatusFilter;
  onStatusFilterChange: (value: ServiceStatusFilter) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderStatusFilter = (
  statusFilter: ServiceStatusFilter,
  onStatusFilterChange: (value: ServiceStatusFilter) => void,
  layout: 'desktop' | 'sheet',
) => (
  <ButtonFilterGroup
    label="Estado"
    options={STATUS_OPTIONS}
    value={statusFilter}
    onChange={onStatusFilterChange}
    layout={layout}
    getOptionAriaLabel={(_label, optionLabel) =>
      `Filtrar por ${optionLabel.toLowerCase()}`
    }
  />
);

export const ServicesFilterBar = ({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: ServicesFilterBarProps) => (
  // One bar for both layouts: the phone sheet, chips and sort below lg, the pill and
  // Limpiar filtros on the search row from lg (ZIG-I33 §2).
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por nombre o descripción...',
      ariaLabel: 'Buscar servicios',
    }}
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Estado del servicio y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    clearAriaLabel="Limpiar filtros de servicios"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderStatusFilter(statusFilter, onStatusFilterChange, 'sheet')}
        <MobileSortSelect
          sorting={sorting}
          onSortingChange={onSortingChange}
          options={SERVICES_MOBILE_SORT_OPTIONS}
          encodeSortingState={encodeSortingState}
          decodeSortingState={decodeSortingState}
          id="service-sort-sheet"
          ariaLabel="Ordenar lista de servicios"
          layout="sheet"
        />
      </>
    }
    filters={
      <ListFilterSelect
        value={statusFilter}
        allValue="active"
        onChange={onStatusFilterChange}
        options={STATUS_OPTIONS}
        ariaLabel="Filtrar servicios por estado"
      />
    }
  />
);
