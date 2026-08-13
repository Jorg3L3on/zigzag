import type { SortingState } from '@tanstack/react-table';
import {
  ROLES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/roles/roles-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-filter';

export type CompanyScopeFilter = 'all' | 'global' | 'company';
export type PermissionAssignmentFilter = 'all' | 'with' | 'without';

const COMPANY_SCOPE_OPTIONS = [
  { value: 'all' as const, label: 'Todas las empresas' },
  { value: 'global' as const, label: 'Sin empresa' },
  { value: 'company' as const, label: 'Por empresa' },
];

const PERMISSION_OPTIONS = [
  { value: 'all' as const, label: 'Todos los roles' },
  { value: 'with' as const, label: 'Con permisos' },
  { value: 'without' as const, label: 'Sin permisos' },
];

type RolesFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  companyScopeFilter: CompanyScopeFilter;
  onCompanyScopeFilterChange: (value: CompanyScopeFilter) => void;
  permissionAssignmentFilter: PermissionAssignmentFilter;
  onPermissionAssignmentFilterChange: (value: PermissionAssignmentFilter) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderFilters = (
  companyScopeFilter: CompanyScopeFilter,
  onCompanyScopeFilterChange: (value: CompanyScopeFilter) => void,
  permissionAssignmentFilter: PermissionAssignmentFilter,
  onPermissionAssignmentFilterChange: (value: PermissionAssignmentFilter) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
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
    <ButtonFilterGroup
      label="Permisos"
      options={PERMISSION_OPTIONS}
      value={permissionAssignmentFilter}
      onChange={onPermissionAssignmentFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar por permisos: ${optionLabel.toLowerCase()}`
      }
    />
  </>
);

export const RolesFilterBar = ({
  searchValue,
  onSearchChange,
  companyScopeFilter,
  onCompanyScopeFilterChange,
  permissionAssignmentFilter,
  onPermissionAssignmentFilterChange,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: RolesFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por rol, descripción, empresa o permiso..."
    searchAriaLabel="Buscar roles"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Alcance, permisos y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de roles"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderFilters(
          companyScopeFilter,
          onCompanyScopeFilterChange,
          permissionAssignmentFilter,
          onPermissionAssignmentFilterChange,
          'sheet',
        )}
        <MobileSortSelect
          sorting={sorting}
          onSortingChange={onSortingChange}
          options={ROLES_MOBILE_SORT_OPTIONS}
          encodeSortingState={encodeSortingState}
          decodeSortingState={decodeSortingState}
          id="role-sort-sheet"
          ariaLabel="Ordenar lista de roles"
          layout="sheet"
        />
      </>
    }
    desktopContent={renderFilters(
      companyScopeFilter,
      onCompanyScopeFilterChange,
      permissionAssignmentFilter,
      onPermissionAssignmentFilterChange,
      'desktop',
    )}
  />
);
