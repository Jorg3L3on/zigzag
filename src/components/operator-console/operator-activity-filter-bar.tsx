import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
} from '@/lib/audit-catalog';
import {
  formatAuditActionLabel,
  formatAuditResourceTypeLabel,
  formatAuditResultLabel,
} from '@/lib/audit-labels';
import {
  FILTER_SELECTED_CLASS,
  ListFilterBarShell,
  type ListFilterChip,
} from '@/components/list-page';
import { cn } from '@/lib/utils';

type OperatorActivityFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  resourceType: string;
  onResourceTypeChange: (value: string) => void;
  actionFilter: string;
  onActionFilterChange: (value: string) => void;
  resultFilter: string;
  onResultFilterChange: (value: string) => void;
  incidentsOnly: boolean;
  onIncidentsOnlyChange: (value: boolean) => void;
  sheetFilterCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filterChips: ListFilterChip[];
};

const renderSelectFilters = (
  props: OperatorActivityFilterBarProps,
  layout: 'desktop' | 'sheet',
) => {
  // Every select keeps its caption on desktop too (ZIG-I27-3).
  const stackClass = layout === 'sheet' ? 'space-y-4' : 'flex flex-wrap items-end gap-3';
  const fieldClass = layout === 'sheet' ? 'space-y-2' : 'flex min-w-[12rem] flex-1 flex-col gap-1.5';

  return (
    <div className={stackClass}>
      <div className={fieldClass}>
        <p className="text-caption font-medium text-muted-foreground">Recurso</p>
        <Select value={props.resourceType} onValueChange={props.onResourceTypeChange}>
          <SelectTrigger
            className="min-h-11 rounded-xl"
            aria-label="Filtrar por tipo de recurso"
          >
            <SelectValue placeholder="Recurso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los recursos</SelectItem>
            {AUDIT_RESOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {formatAuditResourceTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={fieldClass}>
        <p className="text-caption font-medium text-muted-foreground">Acción</p>
        <Select value={props.actionFilter} onValueChange={props.onActionFilterChange}>
          <SelectTrigger className="min-h-11 rounded-xl" aria-label="Filtrar por acción">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {AUDIT_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {formatAuditActionLabel(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={fieldClass}>
        <p className="text-caption font-medium text-muted-foreground">Resultado</p>
        <Select value={props.resultFilter} onValueChange={props.onResultFilterChange}>
          <SelectTrigger className="min-h-11 rounded-xl" aria-label="Filtrar por resultado">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los resultados</SelectItem>
            {AUDIT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {formatAuditResultLabel(result)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={layout === 'sheet' ? 'space-y-2' : 'flex flex-col gap-1.5'}>
        <p className="text-caption font-medium text-muted-foreground">Incidentes</p>
        <Button
          type="button"
          variant="outline"
          className={cn('min-h-11 w-full rounded-xl lg:w-auto', props.incidentsOnly && FILTER_SELECTED_CLASS)}
          onClick={() => props.onIncidentsOnlyChange(!props.incidentsOnly)}
          aria-pressed={props.incidentsOnly}
        >
          Solo incidentes
        </Button>
      </div>
    </div>
  );
};

export const OperatorActivityFilterBar = (props: OperatorActivityFilterBarProps) => (
  <ListFilterBarShell
    searchValue={props.searchValue}
    onSearchChange={props.onSearchChange}
    searchPlaceholder="Buscar actividad..."
    searchAriaLabel="Buscar actividad de auditoría"
    searchClassName="pl-9"
    sheetFilterCount={props.sheetFilterCount}
    sheetDescription="Recurso, acción, resultado e incidentes."
    hasActiveFilters={props.hasActiveFilters}
    onClearFilters={props.onClearFilters}
    clearFiltersAriaLabel="Limpiar filtros de actividad"
    filterChips={props.filterChips}
    sheetContent={renderSelectFilters(props, 'sheet')}
    desktopContent={renderSelectFilters(props, 'desktop')}
  />
);
