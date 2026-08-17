import type { ReactNode } from 'react';
import { ListFilter, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { TripledFilterChips } from '@/components/tripled';

export type ListFilterChip = {
  key: string;
  label: string;
  variant?: 'secondary';
};

export type ListFilterBarShellProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchClassName?: string;
  searchContainerClassName?: string;
  searchTrailing?: ReactNode;
  sheetFilterCount: number;
  sheetDescription: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  clearFiltersAriaLabel: string;
  filterChips: ListFilterChip[];
  sheetContent: ReactNode;
  desktopContent: ReactNode;
  showDesktopClear?: boolean;
};

export const ListFilterBarShell = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  searchClassName = 'h-12 rounded-xl bg-muted/30 pl-9 shadow-none sm:h-11 sm:bg-background',
  searchContainerClassName = 'relative min-w-0 flex-1 lg:max-w-md',
  searchTrailing,
  sheetFilterCount,
  sheetDescription,
  hasActiveFilters,
  onClearFilters,
  clearFiltersAriaLabel,
  filterChips,
  sheetContent,
  desktopContent,
  showDesktopClear = true,
}: ListFilterBarShellProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex min-w-0 w-full gap-2">
      <div className={searchContainerClassName}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className={searchClassName}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
        {searchTrailing}
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
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            {sheetContent}
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
      {desktopContent}
      {showDesktopClear && hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 shrink-0 self-end text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onClearFilters}
          aria-label={clearFiltersAriaLabel}
        >
          <X className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
          Limpiar filtros
        </Button>
      ) : null}
    </div>

    <TripledFilterChips chips={filterChips} />
  </div>
);
