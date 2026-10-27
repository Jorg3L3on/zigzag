import type { SortingState } from '@tanstack/react-table';
import {
  ROLES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/roles/roles-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterSelect,
  ListToolbar,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-page';

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

/** Search and filters: pills from lg, the labelled groups and the sort in the phone sheet. */
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
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por rol, descripción, empresa o permiso...',
      ariaLabel: 'Buscar roles',
    }}
    filters={
      <>
        <ListFilterSelect
          value={companyScopeFilter}
          allValue="all"
          onChange={onCompanyScopeFilterChange}
          options={COMPANY_SCOPE_OPTIONS}
          ariaLabel="Filtrar por alcance"
        />
        <ListFilterSelect
          value={permissionAssignmentFilter}
          allValue="all"
          onChange={onPermissionAssignmentFilterChange}
          options={PERMISSION_OPTIONS}
          ariaLabel="Filtrar por permisos"
        />
      </>
    }
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    clearAriaLabel="Limpiar filtros de roles"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Alcance, permisos y orden de la lista."
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
        <ButtonFilterGroup
          label="Permisos"
          options={PERMISSION_OPTIONS}
          value={permissionAssignmentFilter}
          onChange={onPermissionAssignmentFilterChange}
          layout="sheet"
          getOptionAriaLabel={(_label, optionLabel) =>
            `Filtrar por permisos: ${optionLabel.toLowerCase()}`
          }
        />
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
  />
);
