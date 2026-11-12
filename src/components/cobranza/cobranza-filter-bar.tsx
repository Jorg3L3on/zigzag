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
} from '@/components/list-page';

const STATUS_OPTIONS: Array<{ value: CobranzaStatusFilter; label: string }> = (
  ['all', 'pending', 'partial'] as const
).map((value) => ({
  value,
  label: COBRANZA_STATUS_FILTER_LABEL[value],
}));

const AGING_OPTIONS: Array<{ value: CobranzaAgingBucket; label: string }> = (
  ['all', '0-30', '31-90', '90+'] as const
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
      label="¿Pagado?"
      options={STATUS_OPTIONS}
      value={statusFilter}
      onChange={onStatusFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar: ${optionLabel.toLowerCase()}`
      }
    />
    <ButtonFilterGroup
      label="Días sin pagar"
      options={AGING_OPTIONS}
      value={agingFilter}
      onChange={onAgingFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar días sin pagar: ${optionLabel.toLowerCase()}`
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
    searchPlaceholder="Buscar por cliente o número de ticket"
    searchAriaLabel="Buscar en cobranza"
    searchClassName="h-11 pl-9"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Pagado y días sin pagar."
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
