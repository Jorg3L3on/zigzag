'use client';

import type { ReactNode } from 'react';

import { ListFilterBarShell, type ListFilterChip } from '@/components/list-filter/list-filter-bar-shell';

type ListToolbarProps = {
  search: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
  };
  /** Desktop filters, in order: `ListFilterSelect` pills, the date range. */
  filters?: ReactNode;
  hasActiveFilters: boolean;
  /** Clears filters and search; never the sort. */
  onClear: () => void;
  clearAriaLabel?: string;
  /** Right end of the row: `ListColumnsMenu` when the table has 6 or more columns. */
  trailing?: ReactNode;
  /** The phone keeps its sheet, chips and sort (unchanged by ZIG-I33). */
  sheetContent?: ReactNode;
  sheetFilterCount?: number;
  sheetDescription?: string;
  filterChips?: ListFilterChip[];
  mobileSort?: ReactNode;
  moreFiltersLabel?: string;
  quickFilters?: ReactNode;
};

/**
 * The filter row of a desktop list (ZIG-I33 §2): search (debounce it 300 ms in the
 * page, never in the URL), the filter pills, «Limpiar filtros» only while one is on,
 * and «Columnas» at the right. No chips and no sort select from lg; below lg it is
 * the same `ListFilterBarShell` the phone has today.
 */
export const ListToolbar = ({
  search,
  filters,
  hasActiveFilters,
  onClear,
  clearAriaLabel = 'Limpiar filtros',
  trailing,
  sheetContent,
  sheetFilterCount = 0,
  sheetDescription = 'Filtra la lista.',
  filterChips = [],
  mobileSort,
  moreFiltersLabel,
  quickFilters,
}: ListToolbarProps) => (
  <ListFilterBarShell
    desktopInline
    searchValue={search.value}
    onSearchChange={search.onChange}
    searchPlaceholder={search.placeholder}
    searchAriaLabel={search.ariaLabel}
    sheetFilterCount={sheetFilterCount}
    sheetDescription={sheetDescription}
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClear}
    clearFiltersAriaLabel={clearAriaLabel}
    filterChips={filterChips}
    sheetContent={sheetContent}
    desktopContent={filters}
    desktopTrailing={trailing}
    showFilterSheet={sheetContent != null || filters != null}
    mobileSort={mobileSort}
    moreFiltersLabel={moreFiltersLabel}
    quickFilters={quickFilters}
  />
);
