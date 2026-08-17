import type {
  CobranzaAgingBucket,
  CobranzaStatusFilter,
} from '@/lib/cobranza';
import {
  COBRANZA_AGING_LABEL,
  COBRANZA_STATUS_FILTER_LABEL,
} from '@/lib/cobranza';
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-filter';

const STATUS_OPTIONS: Array<{ value: CobranzaStatusFilter; label: string }> = (
  ['all', 'pending', 'partial'] as const
).map((value) => ({
  value,
  label: COBRANZA_STATUS_FILTER_LABEL[value],
}));

const AGING_OPTIONS: Array<{ value: CobranzaAgingBucket; label: string }> = (
  ['all', '0-14', '15-30', '30+'] as const
).map((value) => ({
  value,
  label: COBRANZA_AGING_LABEL[value],
}));

type CobranzaFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: CobranzaStatusFilter;
  onStatusFilterChange: (value: CobranzaStatusFilter) => void;
  agingFilter: CobranzaAgingBucket;
  onAgingFilterChange: (value: CobranzaAgingBucket) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderFilters = (
  statusFilter: CobranzaStatusFilter,
  onStatusFilterChange: (value: CobranzaStatusFilter) => void,
  agingFilter: CobranzaAgingBucket,
  onAgingFilterChange: (value: CobranzaAgingBucket) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
    <ButtonFilterGroup
      label="Estado de cobro"
      options={STATUS_OPTIONS}
      value={statusFilter}
      onChange={onStatusFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar estado de cobro: ${optionLabel.toLowerCase()}`
      }
    />
    <ButtonFilterGroup
      label="Antigüedad"
      options={AGING_OPTIONS}
      value={agingFilter}
      onChange={onAgingFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar antigüedad: ${optionLabel.toLowerCase()}`
      }
    />
  </>
);

export const CobranzaFilterBar = ({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  agingFilter,
  onAgingFilterChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: CobranzaFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por cliente o ID"
    searchAriaLabel="Buscar en cobranza"
    searchClassName="h-11 pl-9"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Estado de cobro y antigüedad del saldo."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de cobranza"
    filterChips={filterChips}
    sheetContent={renderFilters(
      statusFilter,
      onStatusFilterChange,
      agingFilter,
      onAgingFilterChange,
      'sheet',
    )}
    desktopContent={renderFilters(
      statusFilter,
      onStatusFilterChange,
      agingFilter,
      onAgingFilterChange,
      'desktop',
    )}
  />
);
