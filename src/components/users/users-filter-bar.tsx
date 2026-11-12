import type { SortingState } from '@tanstack/react-table';
import {
  USERS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/users/users-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterSelect,
  ListToolbar,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-page';

export type VerificationFilter = 'all' | 'verified' | 'unverified';
export type CompanyAssignmentFilter = 'all' | 'assigned' | 'unassigned';

const VERIFICATION_OPTIONS = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'verified' as const, label: 'Verificados' },
  { value: 'unverified' as const, label: 'Sin verificar' },
];

/** A pill shows only its value, so «Todos» says what it is about. */
const VERIFICATION_PILL_OPTIONS = [
  { value: 'all' as const, label: 'Todos los correos' },
  ...VERIFICATION_OPTIONS.slice(1),
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

/** Search and filters: pills from lg, the labelled groups and the sort in the phone sheet. */
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
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por nombre, correo, empresa, rol o ID...',
      ariaLabel: 'Buscar usuarios',
    }}
    filters={
      <>
        <ListFilterSelect
          value={verificationFilter}
          allValue="all"
          onChange={onVerificationFilterChange}
          options={VERIFICATION_PILL_OPTIONS}
          ariaLabel="Filtrar por verificación del correo"
        />
        <ListFilterSelect
          value={companyAssignmentFilter}
          allValue="all"
          onChange={onCompanyAssignmentFilterChange}
          options={COMPANY_OPTIONS}
          ariaLabel="Filtrar por empresa"
        />
      </>
    }
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    clearAriaLabel="Limpiar filtros de usuarios"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Verificación, empresa y orden de la lista."
    filterChips={filterChips}
    sheetContent={
      <>
        <ButtonFilterGroup
          label="Verificación"
          options={VERIFICATION_OPTIONS}
          value={verificationFilter}
          onChange={onVerificationFilterChange}
          layout="sheet"
          getOptionAriaLabel={(_label, optionLabel) =>
            `Filtrar correo: ${optionLabel.toLowerCase()}`
          }
        />
        <ButtonFilterGroup
          label="Empresa"
          options={COMPANY_OPTIONS}
          value={companyAssignmentFilter}
          onChange={onCompanyAssignmentFilterChange}
          layout="sheet"
          getOptionAriaLabel={(_label, optionLabel) =>
            `Filtrar ${optionLabel.toLowerCase()}`
          }
        />
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
  />
);
