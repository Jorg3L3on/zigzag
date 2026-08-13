import type { ReactNode } from 'react';
import type { SortingState } from '@tanstack/react-table';
import {
  COMPANIES_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/companies/companies-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  MobileSortSelect,
  type ButtonFilterOption,
  type ListFilterChip,
} from '@/components/list-filter';

export type CompaniesStatusFilter = 'all' | 'setup' | 'active' | 'restricted';

export const COMPANIES_STATUS_FILTER_OPTIONS: Array<
  ButtonFilterOption<CompaniesStatusFilter>
> = [
  { value: 'all', label: 'Todas' },
  { value: 'setup', label: 'En configuración' },
  { value: 'active', label: 'Activas' },
  { value: 'restricted', label: 'Suspendidas / archivadas' },
];

export const FLEET_STATUS_FILTER_OPTIONS: Array<
  ButtonFilterOption<
    'all' | 'setup' | 'active' | 'suspended' | 'archived'
  >
> = [
  { value: 'all', label: 'Todas' },
  { value: 'setup', label: 'En configuración' },
  { value: 'active', label: 'Activas' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'archived', label: 'Archivadas' },
];

type CompaniesFilterBarProps<T extends string> = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: T;
  onStatusFilterChange: (value: T) => void;
  statusOptions: Array<ButtonFilterOption<T>>;
  sorting?: SortingState;
  onSortingChange?: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
  clearFiltersAriaLabel?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  searchClassName?: string;
  searchTrailing?: ReactNode;
  showSort?: boolean;
};

export const CompaniesFilterBar = <T extends string>({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
  clearFiltersAriaLabel = 'Limpiar filtros de empresas',
  searchPlaceholder = 'Buscar por nombre, correo o teléfono...',
  searchAriaLabel = 'Buscar empresas',
  searchClassName,
  searchTrailing,
  showSort = true,
}: CompaniesFilterBarProps<T>) => {
  const renderStatus = (layout: 'desktop' | 'sheet') => (
    <ButtonFilterGroup
      label="Estado"
      options={statusOptions}
      value={statusFilter}
      onChange={onStatusFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar por estado: ${optionLabel.toLowerCase()}`
      }
    />
  );

  const sortBlock =
    showSort && sorting && onSortingChange ? (
      <MobileSortSelect
        sorting={sorting}
        onSortingChange={onSortingChange}
        options={COMPANIES_MOBILE_SORT_OPTIONS}
        encodeSortingState={encodeSortingState}
        decodeSortingState={decodeSortingState}
        id="company-sort-sheet"
        ariaLabel="Ordenar lista de empresas"
        layout="sheet"
      />
    ) : null;

  return (
    <ListFilterBarShell
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchAriaLabel={searchAriaLabel}
      searchClassName={searchClassName}
      searchTrailing={searchTrailing}
      sheetFilterCount={sheetFilterCount}
      sheetDescription={
        showSort
          ? 'Estado de la empresa y orden de la lista.'
          : 'Estado de la empresa.'
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersAriaLabel={clearFiltersAriaLabel}
      filterChips={filterChips}
      sheetContent={
        <>
          {renderStatus('sheet')}
          {sortBlock}
        </>
      }
      desktopContent={renderStatus('desktop')}
      showDesktopClear={hasActiveFilters}
    />
  );
};
