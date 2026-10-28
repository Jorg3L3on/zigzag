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
} from '@/components/list-page';
import { ListFilterSelect, ListToolbar } from '@/components/list-page';

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
  /**
   * The ZIG-I33 filter row: from lg the status is a pill (`ListToolbar`) and the
   * chips hide; the phone sheet keeps the labelled group. Off for the operator fleet
   * until it moves to the standard.
   */
  desktopPills?: boolean;
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
  desktopPills = false,
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

  const sheetDescription = showSort
    ? 'Estado de la empresa y orden de la lista.'
    : 'Estado de la empresa.';

  if (desktopPills) {
    // A pill shows only its value, so the «all» option says what it is about.
    const pillOptions = statusOptions.map((option, index) =>
      index === 0 ? { ...option, label: 'Todos los estados' } : option,
    );
    return (
      <ListToolbar
        search={{
          value: searchValue,
          onChange: onSearchChange,
          placeholder: searchPlaceholder,
          ariaLabel: searchAriaLabel,
        }}
        filters={
          <ListFilterSelect
            value={statusFilter}
            allValue={statusOptions[0].value}
            onChange={onStatusFilterChange}
            options={pillOptions}
            ariaLabel="Filtrar por estado"
          />
        }
        hasActiveFilters={hasActiveFilters}
        onClear={onClearFilters}
        clearAriaLabel={clearFiltersAriaLabel}
        sheetFilterCount={sheetFilterCount}
        sheetDescription={sheetDescription}
        filterChips={filterChips}
        sheetContent={
          <>
            {renderStatus('sheet')}
            {sortBlock}
          </>
        }
      />
    );
  }

  return (
    <ListFilterBarShell
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchAriaLabel={searchAriaLabel}
      searchClassName={searchClassName}
      searchTrailing={searchTrailing}
      sheetFilterCount={sheetFilterCount}
      sheetDescription={sheetDescription}
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
