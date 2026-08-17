import type { SortingState } from '@tanstack/react-table';
import {
  PERMISSIONS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/permissions/permissions-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-filter';

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

const renderScopeFilter = (
  companyScopeFilter: PermissionsCompanyScopeFilter,
  onCompanyScopeFilterChange: (value: PermissionsCompanyScopeFilter) => void,
  layout: 'desktop' | 'sheet',
) => (
  <ButtonFilterGroup
    label="Alcance"
    options={COMPANY_SCOPE_OPTIONS}
    value={companyScopeFilter}
    onChange={onCompanyScopeFilterChange}
    layout={layout}
    getOptionAriaLabel={(_label, optionLabel) =>
      `Filtrar por alcance: ${optionLabel.toLowerCase()}`
    }
  />
);

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
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por permiso, descripción o empresa..."
    searchAriaLabel="Buscar permisos"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Alcance y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de permisos"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderScopeFilter(
          companyScopeFilter,
          onCompanyScopeFilterChange,
          'sheet',
        )}
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
    desktopContent={renderScopeFilter(
      companyScopeFilter,
      onCompanyScopeFilterChange,
      'desktop',
    )}
  />
);
