import type { SortingState } from '@tanstack/react-table';
import {
  CLIENTS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/clients/clients-sort-presets';
import {
  ButtonFilterGroup,
  ListFilterSelect,
  ListToolbar,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-page';

export type ContactFilter = 'all' | 'with' | 'without';

const EMAIL_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Todas' },
  { value: 'with' as const, label: 'Con correo' },
  { value: 'without' as const, label: 'Sin correo' },
];

const PHONE_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'with' as const, label: 'Con teléfono' },
  { value: 'without' as const, label: 'Sin teléfono' },
];

/** The desktop pills say what they filter, since they have no label above (ZIG-30). */
const EMAIL_SELECT_OPTIONS = [
  { value: 'all' as const, label: 'Con y sin correo' },
  { value: 'with' as const, label: 'Con correo' },
  { value: 'without' as const, label: 'Sin correo' },
];

const PHONE_SELECT_OPTIONS = [
  { value: 'all' as const, label: 'Con y sin teléfono' },
  { value: 'with' as const, label: 'Con teléfono' },
  { value: 'without' as const, label: 'Sin teléfono' },
];

type ClientsFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  emailFilter: ContactFilter;
  onEmailFilterChange: (value: ContactFilter) => void;
  phoneFilter: ContactFilter;
  onPhoneFilterChange: (value: ContactFilter) => void;
  sorting: SortingState;
  onSortingChange: (value: SortingState) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderContactFilters = (
  emailFilter: ContactFilter,
  onEmailFilterChange: (value: ContactFilter) => void,
  phoneFilter: ContactFilter,
  onPhoneFilterChange: (value: ContactFilter) => void,
  layout: 'desktop' | 'sheet',
) => (
  <>
    <ButtonFilterGroup
      label="Correo"
      options={EMAIL_FILTER_OPTIONS}
      value={emailFilter}
      onChange={onEmailFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar clientes por correo: ${optionLabel}`
      }
    />
    <ButtonFilterGroup
      label="Teléfono"
      options={PHONE_FILTER_OPTIONS}
      value={phoneFilter}
      onChange={onPhoneFilterChange}
      layout={layout}
      getOptionAriaLabel={(_label, optionLabel) =>
        `Filtrar clientes por teléfono: ${optionLabel}`
      }
    />
  </>
);

export const ClientsFilterBar = ({
  searchValue,
  onSearchChange,
  emailFilter,
  onEmailFilterChange,
  phoneFilter,
  onPhoneFilterChange,
  sorting,
  onSortingChange,
  sheetFilterCount,
  hasActiveFilters,
  onClearFilters,
  filterChips,
}: ClientsFilterBarProps) => (
  // One bar for both layouts: the phone sheet, chips and sort below lg, the pills
  // and Limpiar filtros on the search row from lg (ZIG-I33 §2).
  <ListToolbar
    search={{
      value: searchValue,
      onChange: onSearchChange,
      placeholder: 'Buscar por nombre, teléfono, correo o documento...',
      ariaLabel: 'Buscar clientes',
    }}
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Correo, teléfono y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClear={onClearFilters}
    clearAriaLabel="Limpiar filtros de clientes"
    filterChips={filterChips}
    sheetContent={
      <>
        {renderContactFilters(
          emailFilter,
          onEmailFilterChange,
          phoneFilter,
          onPhoneFilterChange,
          'sheet',
        )}
        <MobileSortSelect
          sorting={sorting}
          onSortingChange={onSortingChange}
          options={CLIENTS_MOBILE_SORT_OPTIONS}
          encodeSortingState={encodeSortingState}
          decodeSortingState={decodeSortingState}
          id="client-sort-sheet"
          ariaLabel="Ordenar lista de clientes"
          layout="sheet"
        />
      </>
    }
    filters={
      <>
        <ListFilterSelect
          value={emailFilter}
          allValue="all"
          onChange={onEmailFilterChange}
          options={EMAIL_SELECT_OPTIONS}
          ariaLabel="Filtrar clientes por correo"
        />
        <ListFilterSelect
          value={phoneFilter}
          allValue="all"
          onChange={onPhoneFilterChange}
          options={PHONE_SELECT_OPTIONS}
          ariaLabel="Filtrar clientes por teléfono"
        />
      </>
    }
  />
);
