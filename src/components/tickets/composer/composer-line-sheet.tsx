'use client';

import { useMemo, useState } from 'react';

import type { Service } from '@/db/schema';
import { BottomSheet, NumberTicker } from '@/components/motion';
import {
  InlineServiceFields,
  ServiceLineModeToggle,
  type ServiceLineMode,
} from '@/components/tickets/service-line-source-fields';
import { TicketServiceLineEditor } from '@/components/tickets/ticket-service-line-editor';
import {
  formatServiceCurrency,
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { multiplyMoney, roundMoney } from '@/lib/money';
import type { TicketComposerDraftLine } from '@/lib/ticket-composer-draft';

export type ComposerLineInput = Omit<TicketComposerDraftLine, 'key'>;

type ComposerLineSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  servicesLoading: boolean;
  /** Present when editing an existing draft line. */
  initialLine: TicketComposerDraftLine | null;
  onSubmit: (line: ComposerLineInput) => void;
  /** Noun for copy ("ticket" / "presupuesto"). */
  documentLabel?: string;
};

const servicePrice = (item: Service | undefined): number =>
  item ? roundMoney(Number(item.price) || 0) : 0;

const isInlineDraftLine = (line: TicketComposerDraftLine | null): boolean =>
  line != null && (line.kind === 'custom' || line.service_id == null);

/**
 * Add / edit one composer line: Del catálogo (pick a Service) or Nuevo (type it
 * inline, ZIG-I5 D2) + Cantidad × Precio with a live subtotal. Agregar never
 * writes to the catalog; Guardar en mi catálogo is applied by the server in the
 * save transaction. Mount it with a fresh `key` per open so the form starts clean.
 */
export const ComposerLineSheet = ({
  open,
  onOpenChange,
  services,
  servicesLoading,
  initialLine,
  onSubmit,
  documentLabel = 'ticket',
}: ComposerLineSheetProps) => {
  const editingInline = isInlineDraftLine(initialLine);
  const [mode, setMode] = useState<ServiceLineMode>(
    editingInline ? 'custom' : 'catalog',
  );
  const [serviceId, setServiceId] = useState(
    initialLine && !editingInline && initialLine.service_id != null
      ? String(initialLine.service_id)
      : '',
  );
  const [customName, setCustomName] = useState(
    editingInline ? (initialLine?.service_name ?? '') : '',
  );
  const [customDescription, setCustomDescription] = useState(
    editingInline ? (initialLine?.description ?? '') : '',
  );
  const [saveToCatalog, setSaveToCatalog] = useState(
    editingInline ? initialLine?.save_to_catalog === true : false,
  );
  const [quantity, setQuantity] = useState(
    initialLine ? String(initialLine.quantity) : '1',
  );
  const [price, setPrice] = useState(
    initialLine ? String(initialLine.price) : '',
  );

  const options = useMemo(
    () =>
      services.map((item) => ({
        value: String(item.id),
        label: `${item.name} · ${formatServiceCurrency(servicePrice(item))}`,
      })),
    [services],
  );

  const selectedService = services.find((item) => String(item.id) === serviceId);
  const quantityValue = sanitizeInteger(quantity);
  const priceValue = roundMoney(sanitizeDecimal(price));
  const isEditing = initialLine !== null;
  const editingCatalogLine =
    initialLine && !editingInline && initialLine.service_id != null
      ? initialLine
      : null;
  const trimmedName = customName.trim();
  const canSubmit =
    mode === 'custom'
      ? trimmedName.length > 0
      : Boolean(selectedService || (editingCatalogLine && serviceId));

  const handleServiceChange = (value: string) => {
    setServiceId(value);
    const match = services.find((item) => String(item.id) === value);
    if (match) {
      setPrice(String(servicePrice(match)));
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'custom') {
      const description = customDescription.trim();
      onSubmit({
        kind: 'custom',
        service_id: null,
        service_name: trimmedName,
        ...(description ? { description } : {}),
        save_to_catalog: saveToCatalog,
        quantity: quantityValue,
        price: priceValue,
      });
    } else {
      onSubmit({
        kind: 'catalog',
        service_id: selectedService?.id ?? editingCatalogLine!.service_id,
        service_name: selectedService?.name ?? editingCatalogLine!.service_name,
        quantity: quantityValue,
        price: priceValue,
      });
    }
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar servicio' : 'Agregar servicio'}
      description={
        mode === 'custom'
          ? `Escríbelo aquí. Sólo vive en este ${documentLabel} si no lo guardas en tu catálogo.`
          : 'Elige el servicio, la cantidad y el precio.'
      }
      data-testid="composer-line-sheet"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isEditing ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ServiceLineModeToggle
          idPrefix="composer-line"
          value={mode}
          onValueChange={setMode}
        />

        {mode === 'custom' ? (
          <InlineServiceFields
            idPrefix="composer-line"
            name={customName}
            onNameChange={setCustomName}
            description={customDescription}
            onDescriptionChange={setCustomDescription}
            saveToCatalog={saveToCatalog}
            onSaveToCatalogChange={setSaveToCatalog}
            documentLabel={documentLabel}
            autoFocus={!isEditing}
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="composer-line-service">Servicio</Label>
            <SearchableSelect
              id="composer-line-service"
              aria-label="Servicio"
              options={options}
              value={serviceId}
              onValueChange={handleServiceChange}
              isLoading={servicesLoading}
              placeholder="Selecciona un servicio"
              searchPlaceholder="Buscar servicio…"
              emptyText="Sin servicios que coincidan"
              className="h-12 w-full rounded-xl border border-input bg-background text-base shadow-sm"
            />
            {!servicesLoading && services.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Tu catálogo está vacío. Usa Nuevo para escribir el servicio.
              </p>
            ) : null}
          </div>
        )}

        <TicketServiceLineEditor
          idPrefix="composer-line"
          quantity={quantity}
          price={price}
          onQuantityStep={(next) => setQuantity(String(next))}
          onPriceStep={(next) => setPrice(String(next))}
          onQuantityInput={(value) => setQuantity(value.replace(/[^\d]/g, ''))}
          onPriceInput={setPrice}
        />

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subtotal
            </p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {quantityValue} × {formatServiceCurrency(priceValue)}
            </p>
          </div>
          <NumberTicker
            value={multiplyMoney(priceValue, quantityValue)}
            format={formatServiceCurrency}
            className="shrink-0 text-lg font-semibold text-foreground"
            data-testid="composer-line-subtotal"
          />
        </div>
      </div>
    </BottomSheet>
  );
};
