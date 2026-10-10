'use client';

import { useState } from 'react';
import { BookmarkPlus, X } from 'lucide-react';

import { MaterialNameAutocomplete } from '@/components/materials/material-name-autocomplete';
import {
  ServiceLineModeToggle,
  type ServiceLineMode,
} from '@/components/tickets/service-line-source-fields';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  formatMaterialQuantity,
  materialDraftAmount,
  newMaterialKey,
  type MaterialDraft,
} from '@/lib/material-drafts';
import { roundMoney } from '@/lib/money';
import {
  MATERIAL_UNIT_SUGGESTIONS,
  type MaterialOption,
} from '@/lib/service-materials';
import {
  MATERIAL_NAME_MAX_LENGTH,
  MATERIAL_UNIT_MAX_LENGTH,
} from '@/lib/ticket-service-line-schema';
import { cn } from '@/lib/utils';

/**
 * `service`: Servicios form defaults. The name autocompletes from the catalog;
 * picking links it, typing a new name creates it on save.
 * `line`: a document line. Del catálogo (pick) or Nuevo (inline, optional
 * Guardar en mi catálogo), like service lines in ZIG-I5.
 */
export type MaterialEntryVariant = 'service' | 'line';

const parseDecimal = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Keeps digits and one decimal separator, at most two decimals. */
const cleanDecimalInput = (value: string): string => {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

export type MaterialEntryState = ReturnType<typeof useMaterialEntry>;

/** State of one material being added or edited. */
export const useMaterialEntry = (
  variant: MaterialEntryVariant,
  initial: MaterialDraft | null,
) => {
  const [mode, setMode] = useState<ServiceLineMode>(
    variant === 'line' && initial && initial.material_id == null ? 'custom' : 'catalog',
  );
  const [materialId, setMaterialId] = useState<number | null>(
    initial?.material_id ?? null,
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [saveToCatalog, setSaveToCatalog] = useState(initial?.save_to_catalog ?? false);

  const quantityValue = roundMoney(parseDecimal(quantity));
  const priceValue = roundMoney(parseDecimal(price));
  const trimmedName = name.trim();
  const catalogPick = variant === 'line' && mode === 'catalog';
  const canSubmit =
    quantityValue >= 0.01 &&
    quantityValue <= 9999.99 &&
    price.trim() !== '' &&
    (catalogPick ? materialId != null : trimmedName.length > 0);

  const pick = (option: MaterialOption) => {
    setMaterialId(option.id);
    setName(option.name);
    setUnit(option.unit ?? '');
    setPrice(String(option.price));
  };

  const toDraft = (): MaterialDraft => {
    const linked = catalogPick || (variant === 'service' && materialId != null);
    return {
      key: initial?.key ?? newMaterialKey(),
      material_id: linked ? materialId : null,
      name: trimmedName,
      unit: unit.trim() || null,
      quantity: quantityValue,
      price: priceValue,
      save_to_catalog: !linked && variant === 'line' ? saveToCatalog : false,
    };
  };

  return {
    variant,
    mode,
    setMode: (next: ServiceLineMode) => {
      setMode(next);
      if (next === 'custom') setMaterialId(null);
    },
    materialId,
    clearPick: () => {
      setMaterialId(null);
      setName('');
      setUnit('');
    },
    name,
    setName: (value: string) => {
      setName(value);
      // Typing a different name unlinks a picked catalog material.
      if (variant === 'service') setMaterialId(null);
    },
    unit,
    setUnit,
    quantity,
    setQuantity: (value: string) => setQuantity(cleanDecimalInput(value)),
    price,
    setPrice: (value: string) => setPrice(cleanDecimalInput(value)),
    saveToCatalog,
    setSaveToCatalog,
    quantityValue,
    priceValue,
    canSubmit,
    pick,
    toDraft,
  };
};

type UnitFieldProps = {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
};

const UnitField = ({ idPrefix, value, onChange }: UnitFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={`${idPrefix}-unit`}>
      Unidad <span className="font-normal text-muted-foreground">(opcional)</span>
    </Label>
    <div className="flex flex-wrap items-center gap-1.5">
      {MATERIAL_UNIT_SUGGESTIONS.map((suggestion) => {
        const selected = value.trim().toLowerCase() === suggestion;
        return (
          <button
            key={suggestion}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : suggestion)}
            className={cn(
              'h-9 min-w-11 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {suggestion}
          </button>
        );
      })}
      <Input
        id={`${idPrefix}-unit`}
        value={value}
        maxLength={MATERIAL_UNIT_MAX_LENGTH}
        autoComplete="off"
        placeholder="Otra"
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-24 rounded-full text-sm"
      />
    </div>
  </div>
);

type MaterialEntryFieldsProps = {
  idPrefix: string;
  entry: MaterialEntryState;
  companyId?: number | null;
  /** Document noun for the Guardar en mi catálogo hint. */
  documentLabel?: string;
  autoFocus?: boolean;
};

/** The fields of one material; the container owns the buttons. */
export const MaterialEntryFields = ({
  idPrefix,
  entry,
  companyId,
  documentLabel = 'documento',
  autoFocus = false,
}: MaterialEntryFieldsProps) => {
  const isLine = entry.variant === 'line';
  const catalogPick = isLine && entry.mode === 'catalog';
  const picked = catalogPick && entry.materialId != null;
  const linkedInService = entry.variant === 'service' && entry.materialId != null;

  return (
    <div className="space-y-4">
      {isLine ? (
        <ServiceLineModeToggle
          idPrefix={`${idPrefix}-source`}
          ariaLabel="Origen del material"
          value={entry.mode}
          onValueChange={entry.setMode}
        />
      ) : null}

      {catalogPick ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-search`}>Material</Label>
          {picked ? (
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                {entry.unit ? (
                  <p className="text-xs text-muted-foreground">Unidad: {entry.unit}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Cambiar ${entry.name}`}
                onClick={entry.clearPick}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <MaterialNameAutocomplete
              id={`${idPrefix}-search`}
              value={entry.name}
              onValueChange={entry.setName}
              onPick={entry.pick}
              companyId={companyId}
              placeholder="Buscar en tu catálogo…"
              autoFocus={autoFocus}
              emptyText="Sin materiales que coincidan. Usa Nuevo para escribirlo."
            />
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>Nombre del material</Label>
            {isLine ? (
              <Input
                id={`${idPrefix}-name`}
                value={entry.name}
                maxLength={MATERIAL_NAME_MAX_LENGTH}
                autoFocus={autoFocus}
                autoComplete="off"
                placeholder="Ej. Tubo de cobre 1/4"
                onChange={(event) => entry.setName(event.target.value)}
                className="h-12 rounded-xl text-base md:h-10 md:text-sm"
              />
            ) : (
              <MaterialNameAutocomplete
                id={`${idPrefix}-name`}
                value={entry.name}
                onValueChange={entry.setName}
                onPick={entry.pick}
                companyId={companyId}
                autoFocus={autoFocus}
                aria-describedby={`${idPrefix}-name-hint`}
              />
            )}
            {!isLine ? (
              <p id={`${idPrefix}-name-hint`} className="text-xs text-muted-foreground">
                {linkedInService
                  ? 'De tu catálogo de materiales.'
                  : 'Si no está en tu catálogo, se agrega al guardar el servicio.'}
              </p>
            ) : null}
          </div>
          {linkedInService ? null : (
            <UnitField idPrefix={idPrefix} value={entry.unit} onChange={entry.setUnit} />
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${idPrefix}-quantity`}>Cantidad</Label>
          <Input
            id={`${idPrefix}-quantity`}
            inputMode="decimal"
            value={entry.quantity}
            autoComplete="off"
            onChange={(event) => entry.setQuantity(event.target.value)}
            className="h-12 rounded-xl text-base tabular-nums md:h-10 md:text-sm"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${idPrefix}-price`}>
            Precio{entry.unit.trim() ? ` / ${entry.unit.trim()}` : ''}
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id={`${idPrefix}-price`}
              inputMode="decimal"
              value={entry.price}
              autoComplete="off"
              placeholder="0.00"
              onChange={(event) => entry.setPrice(event.target.value)}
              className="h-12 rounded-xl pl-7 text-base tabular-nums md:h-10 md:text-sm"
            />
          </div>
        </div>
      </div>

      {isLine && !catalogPick ? (
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
              {entry.saveToCatalog
                ? 'También quedará en tu catálogo de materiales.'
                : `Sólo en este ${documentLabel}. Tu catálogo no cambia.`}
            </p>
          </div>
          <Switch
            id={`${idPrefix}-save-to-catalog`}
            checked={entry.saveToCatalog}
            onCheckedChange={entry.setSaveToCatalog}
            aria-describedby={`${idPrefix}-save-to-catalog-hint`}
          />
        </div>
      ) : null}

      <p className="text-right text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {formatMaterialQuantity(entry.quantityValue, entry.unit)} ×{' '}
        {formatServiceCurrency(entry.priceValue)} ={' '}
        <span className="font-semibold text-foreground">
          {formatServiceCurrency(
            materialDraftAmount({ quantity: entry.quantityValue, price: entry.priceValue }),
          )}
        </span>
      </p>
    </div>
  );
};
