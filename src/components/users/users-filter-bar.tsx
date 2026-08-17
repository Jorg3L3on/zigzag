import type { SortingState } from '@tanstack/react-table';
import {
  USERS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/users/users-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-filter';

export type VerificationFilter = 'all' | 'verified' | 'unverified';
export type CompanyAssignmentFilter = 'all' | 'assigned' | 'unassigned';

const VERIFICATION_OPTIONS = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'verified' as const, label: 'Verificados' },
  { value: 'unverified' as const, label: 'Sin verificar' },
];

const COMPANY_OPTIONS = [
  { value: 'all' as const, label: 'Empresa: todas' },
  { value: 'assigned' as const, label: 'Con empresa' },
  { value: 'unassigned' as const, label: 'Sin empresa' },
];

type UsersFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  verificationFilter: VerificationFilter;
  onVerificationFilterChange: (value: VerificationFilter) => void;
  companyAssignmentFilter: CompanyAssignmentFilter;
  onCompanyAssignmentFilterChange: (value: CompanyAssignmentFilter) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderFilters = (
  verificationFilter: VerificationFilter,
  onVerificationFilterChange: (value: VerificationFilter) => void,
  companyAssignmentFilter: CompanyAssignmentFilter,
  onCompanyAssignmentFilterChange: (value: CompanyAssignmentFilter) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
    <ButtonFilterGroup
      label="Verificación"
      options={VERIFICATION_OPTIONS}
      value={verificationFilter}
      onChange={onVerificationFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar correo: ${optionLabel.toLowerCase()}`
      }
    />
    <ButtonFilterGroup
      label="Empresa"
      options={COMPANY_OPTIONS}
      value={companyAssignmentFilter}
      onChange={onCompanyAssignmentFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar ${optionLabel.toLowerCase()}`
      }
    />
  </>
);

export const UsersFilterBar = ({
  searchValue,
  onSearchChange,
  verificationFilter,
  onVerificationFilterChange,
  companyAssignmentFilter,
  onCompanyAssignmentFilterChange,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: UsersFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por nombre, correo, empresa, rol o ID..."
    searchAriaLabel="Buscar usuarios"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Verificación, empresa y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de usuarios"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderFilters(
          verificationFilter,
          onVerificationFilterChange,
          companyAssignmentFilter,
          onCompanyAssignmentFilterChange,
          'sheet',
        )}
        <MobileSortSelect
          sorting={sorting}
          onSortingChange={onSortingChange}
          options={USERS_MOBILE_SORT_OPTIONS}
          encodeSortingState={encodeSortingState}
          decodeSortingState={decodeSortingState}
          id="user-sort-sheet"
          ariaLabel="Ordenar lista de usuarios"
          layout="sheet"
        />
      </>
    }
    desktopContent={renderFilters(
      verificationFilter,
      onVerificationFilterChange,
      companyAssignmentFilter,
      onCompanyAssignmentFilterChange,
      'desktop',
    )}
  />
);
