'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
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
import { cn } from '@/lib/utils';

export type AuditFilterFieldLayout = 'desktop' | 'sheet';

type SharedFilterProps = {
  layout: AuditFilterFieldLayout;
};

const fieldWrapClass = (layout: AuditFilterFieldLayout) =>
  layout === 'sheet' ? 'space-y-2' : 'min-w-0 space-y-1.5';

const triggerClass = (layout: AuditFilterFieldLayout) =>
  layout === 'sheet' ? 'h-11 w-full' : 'h-10 w-full';

type AuditCompanyFilterProps = SharedFilterProps & {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
};

export const AuditCompanyFilter = ({
  layout,
  value,
  onChange,
  options,
}: AuditCompanyFilterProps) => {
  const id =
    layout === 'sheet' ? 'audit-filter-company-sheet' : 'audit-filter-company';

  return (
    <div className={fieldWrapClass(layout)}>
      {layout === 'sheet' ? (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Empresa objetivo
        </label>
      ) : null}
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder="Empresa objetivo"
        searchPlaceholder="Buscar empresa…"
        emptyText="No hay empresas"
        aria-label="Filtrar por empresa objetivo"
        className={triggerClass(layout)}
      />
    </div>
  );
};

type AuditActorFilterProps = SharedFilterProps & {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
};

export const AuditActorFilter = ({
  layout,
  value,
  onChange,
  options,
}: AuditActorFilterProps) => {
  const id =
    layout === 'sheet' ? 'audit-filter-actor-sheet' : 'audit-filter-actor';

  return (
    <div className={fieldWrapClass(layout)}>
      {layout === 'sheet' ? (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Actor usuario
        </label>
      ) : null}
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder="Actor usuario"
        searchPlaceholder="Buscar usuario…"
        emptyText="No hay usuarios"
        aria-label="Filtrar por actor usuario"
        className={triggerClass(layout)}
      />
    </div>
  );
};

type AuditResourceTypeFilterProps = SharedFilterProps & {
  value: string;
  onChange: (value: string) => void;
};

export const AuditResourceTypeFilter = ({
  layout,
  value,
  onChange,
}: AuditResourceTypeFilterProps) => {
  const id =
    layout === 'sheet'
      ? 'audit-filter-resource-sheet'
      : 'audit-filter-resource';

  return (
    <div className={fieldWrapClass(layout)}>
      {layout === 'sheet' ? (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Tipo de recurso
        </label>
      ) : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={triggerClass(layout)}
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
  );
};

type AuditActionFilterProps = SharedFilterProps & {
  value: string;
  onChange: (value: string) => void;
};

export const AuditActionFilter = ({
  layout,
  value,
  onChange,
}: AuditActionFilterProps) => {
  const id =
    layout === 'sheet' ? 'audit-filter-action-sheet' : 'audit-filter-action';

  return (
    <div className={fieldWrapClass(layout)}>
      {layout === 'sheet' ? (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Acción
        </label>
      ) : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={triggerClass(layout)}
          aria-label="Filtrar por acción"
        >
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
  );
};

type AuditResultFilterProps = SharedFilterProps & {
  value: string;
  onChange: (value: string) => void;
};

export const AuditResultFilter = ({
  layout,
  value,
  onChange,
}: AuditResultFilterProps) => {
  const id =
    layout === 'sheet' ? 'audit-filter-result-sheet' : 'audit-filter-result';

  return (
    <div className={fieldWrapClass(layout)}>
      {layout === 'sheet' ? (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Estatus
        </label>
      ) : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={triggerClass(layout)}
          aria-label="Filtrar por resultado"
        >
          <SelectValue placeholder="Resultado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estatus</SelectItem>
          {AUDIT_RESULTS.map((result) => (
            <SelectItem key={result} value={result}>
              {formatAuditResultLabel(result)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

type AuditDateRangeFilterProps = SharedFilterProps & {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
};

export const AuditDateRangeFilter = ({
  layout,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: AuditDateRangeFilterProps) => {
  const fromId =
    layout === 'sheet' ? 'audit-from-date-sheet' : 'audit-from-date';
  const toId = layout === 'sheet' ? 'audit-to-date-sheet' : 'audit-to-date';

  return (
    <div
      className={cn(
        layout === 'sheet'
          ? 'grid grid-cols-1 gap-4'
          : 'grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-2',
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={fromId}>Desde</Label>
        <Input
          id={fromId}
          type="date"
          value={fromDate}
          onChange={(event) => onFromDateChange(event.target.value)}
          aria-label="Filtrar desde fecha"
          className={layout === 'sheet' ? 'h-11' : undefined}
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={toId}>Hasta</Label>
        <Input
          id={toId}
          type="date"
          value={toDate}
          onChange={(event) => onToDateChange(event.target.value)}
          aria-label="Filtrar hasta fecha"
          className={layout === 'sheet' ? 'h-11' : undefined}
        />
      </div>
    </div>
  );
};
