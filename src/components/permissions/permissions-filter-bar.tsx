import type { SortingState } from '@tanstack/react-table';
import {
  PERMISSIONS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/permissions/permissions-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterSelect,
  ListToolbar,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-page';

export type PermissionsCompanyScopeFilter = 'all' | 'global' | 'company';

const COMPANY_SCOPE_OPTIONS = [
  { value: 'all' as const, label: 'Todas las empresas' },
  { value: 'global' as const, label: 'Sin empresa' },
  { value: 'company' as const, label: 'Por empresa' },
];

type PermissionsFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  companyScopeFilter: PermissionsCompanyScopeFilter;
  onCompanyScopeFilterChange: (value: PermissionsCompanyScopeFilter) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

/** Search and the scope filter: a pill from lg, the labelled group and the sort in the phone sheet. */
export const PermissionsFilterBar = ({
  searchValue,
  onSearchChange,
  companyScopeFilter,
  onCompanyScopeFilterChange,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: PermissionsFilterBarProps) => (
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por permiso, descripción o empresa...',
      ariaLabel: 'Buscar permisos',
    }}
    filters={
      <ListFilterSelect
        value={companyScopeFilter}
        allValue="all"
        onChange={onCompanyScopeFilterChange}
        options={COMPANY_SCOPE_OPTIONS}
        ariaLabel="Filtrar por alcance"
      />
    }
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    clearAriaLabel="Limpiar filtros de permisos"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Alcance y orden de la lista."
    filterChips={filterChips}
    sheetContent={
      <>
        <ButtonFilterGroup
          label="Alcance"
          options={COMPANY_SCOPE_OPTIONS}
          value={companyScopeFilter}
          onChange={onCompanyScopeFilterChange}
          layout="sheet"
          getOptionAriaLabel={(_label, optionLabel) =>
            `Filtrar por alcance: ${optionLabel.toLowerCase()}`
          }
        />
        <MobileSortSelect
          sorting={sorting}
          onSortingChange={onSortingChange}
          options={PERMISSIONS_MOBILE_SORT_OPTIONS}
          encodeSortingState={encodeSortingState}
          decodeSortingState={decodeSortingState}
          id="permission-sort-sheet"
          ariaLabel="Ordenar lista de permisos"
          layout="sheet"
        />
      </>
    }
  />
);
