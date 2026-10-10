'use client';

import { BookmarkPlus, ListChecks, PencilLine } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PdfCharsWarning } from '@/components/pdf/pdf-chars-warning';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@/lib/service-description';
import { SERVICE_LINE_NAME_MAX_LENGTH } from '@/lib/ticket-service-line-schema';
import { cn } from '@/lib/utils';

export type ServiceLineMode = 'catalog' | 'custom';

type ServiceLineModeToggleProps = {
  value: ServiceLineMode;
  onValueChange: (value: ServiceLineMode) => void;
  idPrefix: string;
  /** Accessible name of the radiogroup (materials reuse it, ZIG-I10). */
  ariaLabel?: string;
};

const MODE_OPTIONS: Array<{
  value: ServiceLineMode;
  label: string;
  icon: typeof ListChecks;
}> = [
  { value: 'catalog', label: 'Del catálogo', icon: ListChecks },
  { value: 'custom', label: 'Nuevo', icon: PencilLine },
];

/**
 * Segmented control for the line source (ZIG-I5 D2): pick a catalog service or
 * type a new one inline. A radiogroup so arrow keys move between the two.
 */
export const ServiceLineModeToggle = ({
  value,
  onValueChange,
  idPrefix,
  ariaLabel = 'Origen del servicio',
}: ServiceLineModeToggleProps) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1"
    onKeyDown={(event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = value === 'catalog' ? 'custom' : 'catalog';
      onValueChange(next);
      document.getElementById(`${idPrefix}-mode-${next}`)?.focus();
    }}
  >
    {MODE_OPTIONS.map((option) => {
      const selected = option.value === value;
      const Icon = option.icon;
      return (
        <button
          key={option.value}
          id={`${idPrefix}-mode-${option.value}`}
          type="button"
          role="radio"
          aria-checked={selected}
          tabIndex={selected ? 0 : -1}
          onClick={() => onValueChange(option.value)}
          className={cn(
            'flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
            selected
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {option.label}
        </button>
      );
    })}
  </div>
);

type InlineServiceFieldsProps = {
  idPrefix: string;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  saveToCatalog: boolean;
  onSaveToCatalogChange: (value: boolean) => void;
  /** Document noun for the hint ("documento", "ticket", "presupuesto"). */
  documentLabel?: string;
  autoFocus?: boolean;
};

/**
 * Inline service fields: Nombre, Descripción and the Guardar en mi catálogo
 * switch (off by default). Nothing here writes to the catalog; the server does
 * it in the save transaction only when the switch is on.
 */
export const InlineServiceFields = ({
  idPrefix,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  saveToCatalog,
  onSaveToCatalogChange,
  documentLabel = 'documento',
  autoFocus = false,
}: InlineServiceFieldsProps) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-custom-name`}>Nombre del servicio</Label>
      <Input
        id={`${idPrefix}-custom-name`}
        value={name}
        maxLength={SERVICE_LINE_NAME_MAX_LENGTH}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Ej. Cambio de capacitor 35 µF"
        onChange={(event) => onNameChange(event.target.value)}
        className="h-12 rounded-xl text-base md:h-10 md:text-sm"
      />
      <PdfCharsWarning text={name} />
    </div>
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`${idPrefix}-custom-description`}>
          Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {description.length}/{SERVICE_DESCRIPTION_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        id={`${idPrefix}-custom-description`}
        value={description}
        maxLength={SERVICE_DESCRIPTION_MAX_LENGTH}
        rows={2}
        onChange={(event) => onDescriptionChange(event.target.value)}
        className="min-h-[64px] rounded-xl"
      />
      <PdfCharsWarning text={description} />
    </div>
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/25 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label
          htmlFor={`${idPrefix}-save-to-catalog`}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <BookmarkPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
          Guardar en mi catálogo
        </Label>
        <p id={`${idPrefix}-save-to-catalog-hint`} className="text-xs text-muted-foreground">
          {saveToCatalog
            ? 'También quedará en Servicios para usarlo después.'
            : `Sólo en este ${documentLabel}. Tu catálogo no cambia.`}
        </p>
      </div>
      <Switch
        id={`${idPrefix}-save-to-catalog`}
        checked={saveToCatalog}
        onCheckedChange={onSaveToCatalogChange}
        aria-describedby={`${idPrefix}-save-to-catalog-hint`}
      />
    </div>
  </div>
);

type InlineLineChipsProps = {
  isInline: boolean;
  saveToCatalog?: boolean;
  className?: string;
};

/** Chips on a line row: Nuevo for inline lines, → catálogo when it will be saved. */
export const InlineLineChips = ({
  isInline,
  saveToCatalog = false,
  className,
}: InlineLineChipsProps) => {
  if (!isInline) return null;
  return (
    <span className={cn('inline-flex flex-wrap gap-1 align-middle', className)}>
      <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium shadow-none">
        Nuevo
      </Badge>
      {saveToCatalog ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium shadow-none">
          → catálogo
        </Badge>
      ) : null}
    </span>
  );
};
