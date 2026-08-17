import type { SortingState } from '@tanstack/react-table';
<<<<<<< HEAD
=======
import { ListFilter, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
>>>>>>> origin/main
import {
  CLIENTS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/clients/clients-sort-presets';
<<<<<<< HEAD
import {
  ButtonFilterGroup,
  ListFilterBarShell,
  MobileSortSelect,
  type ListFilterChip,
} from '@/components/list-filter';

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
=======
import { TripledFilterChips } from '@/components/tripled';

export type ContactFilter = 'all' | 'with' | 'without';

const EMAIL_FILTER_OPTIONS: Array<{ value: ContactFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'with', label: 'Con correo' },
  { value: 'without', label: 'Sin correo' },
];

const PHONE_FILTER_OPTIONS: Array<{ value: ContactFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'with', label: 'Con teléfono' },
  { value: 'without', label: 'Sin teléfono' },
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
  filterChips: Array<{
    key: string;
    label: string;
    variant?: 'secondary';
  }>;
};

const ContactFilterButtons = ({
  label,
  options,
  value,
  onChange,
  layout,
}: {
  label: string;
  options: Array<{ value: ContactFilter; label: string }>;
  value: ContactFilter;
  onChange: (value: ContactFilter) => void;
  layout: 'desktop' | 'sheet';
}) => (
  <div className={layout === 'sheet' ? 'space-y-2' : 'flex flex-col gap-2'}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? 'default' : 'outline'}
          className="min-h-11 rounded-xl"
          onClick={() => onChange(option.value)}
          aria-label={`Filtrar clientes por ${label.toLowerCase()}: ${option.label}`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </div>
>>>>>>> origin/main
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
<<<<<<< HEAD
}: ClientsFilterBarProps) => (
  <ListFilterBarShell
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder="Buscar por nombre, teléfono, correo o documento..."
    searchAriaLabel="Buscar clientes"
    sheetFilterCount={sheetFilterCount}
    sheetDescription="Correo, teléfono y orden de la lista."
    hasActiveFilters={hasActiveFilters}
    onClearFilters={onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de clientes"
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
    desktopContent={renderContactFilters(
      emailFilter,
      onEmailFilterChange,
      phoneFilter,
      onPhoneFilterChange,
      'desktop',
    )}
  />
);
=======
}: ClientsFilterBarProps) => {
  const mobileSortValue = encodeSortingState(sorting);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 w-full gap-2">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:bg-background"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por nombre, teléfono, correo o documento..."
            aria-label="Buscar clientes"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-12 w-12 shrink-0 rounded-xl bg-background shadow-none lg:hidden"
              aria-label={
                sheetFilterCount > 0
                  ? `Abrir filtros (${sheetFilterCount} activos)`
                  : 'Abrir filtros'
              }
            >
              <ListFilter className="h-4 w-4" aria-hidden data-icon="inline-start" />
              {sheetFilterCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 justify-center px-1 text-[10px] leading-none"
                >
                  {sheetFilterCount > 9 ? '9+' : sheetFilterCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex max-h-[min(90vh,680px)] flex-col rounded-t-2xl border-t p-0"
          >
            <div
              className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted"
              aria-hidden
            />
            <SheetHeader className="space-y-1 px-4 pb-3 pt-2 text-left">
              <SheetTitle
                data-initial-focus
                tabIndex={-1}
                className="outline-none focus:outline-none"
              >
                Filtros
              </SheetTitle>
              <SheetDescription>
                Correo, teléfono y orden de la lista.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
              <ContactFilterButtons
                label="Correo"
                options={EMAIL_FILTER_OPTIONS}
                value={emailFilter}
                onChange={onEmailFilterChange}
                layout="sheet"
              />
              <ContactFilterButtons
                label="Teléfono"
                options={PHONE_FILTER_OPTIONS}
                value={phoneFilter}
                onChange={onPhoneFilterChange}
                layout="sheet"
              />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Orden</p>
                <Select
                  value={mobileSortValue}
                  onValueChange={(value) => onSortingChange(decodeSortingState(value))}
                >
                  <SelectTrigger
                    id="client-sort-sheet"
                    className="h-11 w-full rounded-xl"
                    aria-label="Ordenar lista de clientes"
                  >
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENTS_MOBILE_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onClearFilters}
                  aria-label="Limpiar todos los filtros activos"
                >
                  <X className="mr-2 h-4 w-4 shrink-0" aria-hidden data-icon="inline-start" />
                  Limpiar todos los filtros
                </Button>
              ) : null}
            </div>

            <SheetFooter className="border-t bg-muted/30 px-4 py-3">
              <SheetClose asChild>
                <Button type="button" size="lg" className="min-h-11 w-full">
                  Listo
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden gap-6 lg:flex lg:flex-wrap lg:items-start">
        <ContactFilterButtons
          label="Correo"
          options={EMAIL_FILTER_OPTIONS}
          value={emailFilter}
          onChange={onEmailFilterChange}
          layout="desktop"
        />
        <ContactFilterButtons
          label="Teléfono"
          options={PHONE_FILTER_OPTIONS}
          value={phoneFilter}
          onChange={onPhoneFilterChange}
          layout="desktop"
        />
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 self-end text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onClearFilters}
            aria-label="Limpiar filtros de clientes"
          >
            <X className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <TripledFilterChips chips={filterChips} />
    </div>
  );
};
>>>>>>> origin/main
