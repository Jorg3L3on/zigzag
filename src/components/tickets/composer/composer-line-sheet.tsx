'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Package, Plus } from 'lucide-react';

import type { Service } from '@/db/schema';
import {
  MaterialEntryFields,
  useMaterialEntry,
} from '@/components/materials/material-entry-fields';
import { MaterialRows } from '@/components/materials/material-rows';
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
import {
  materialDraftsFromServiceDefaults,
  materialDraftsTotal,
  type MaterialDraft,
} from '@/lib/material-drafts';
import { addMoney, multiplyMoney, roundMoney } from '@/lib/money';
import type { ServiceMaterialView } from '@/lib/service-materials';
import type { TicketComposerDraftLine } from '@/lib/ticket-composer-draft';
import { MATERIALS_PER_LINE_MAX } from '@/lib/ticket-service-line-schema';

export type ComposerLineInput = Omit<TicketComposerDraftLine, 'key'>;

/** Catalog services; `materials` are their defaults (ZIG-I10). */
export type ComposerService = Service & { materials?: ServiceMaterialView[] };

type ComposerLineSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ComposerService[];
  /** Company for the material catalog search. */
  companyId?: number | null;
  servicesLoading: boolean;
  /** Present when editing an existing draft line. */
  initialLine: TicketComposerDraftLine | null;
  onSubmit: (line: ComposerLineInput) => void;
  /** Noun for copy ("ticket" / "presupuesto"). */
  documentLabel?: string;
};

const servicePrice = (item: ComposerService | undefined): number =>
  item ? roundMoney(Number(item.price) || 0) : 0;

const isInlineDraftLine = (line: TicketComposerDraftLine | null): boolean =>
  line != null && (line.kind === 'custom' || line.service_id == null);

type SheetStep = { kind: 'line' } | { kind: 'material'; editing: MaterialDraft | null };

/**
 * Add / edit one composer line: Del catálogo (pick a Service) or Nuevo (type it
 * inline, ZIG-I5 D2) + Cantidad × Precio with a live subtotal. Agregar never
 * writes to the catalog; Guardar en mi catálogo is applied by the server in the
 * save transaction. Mount it with a fresh `key` per open so the form starts clean.
 *
 * Materiales (ZIG-I10-3): a catalog service prefills its default materials;
 * rows are editable and removable, and Agregar material opens a nested step
 * (Del catálogo or Nuevo) inside the same sheet. Materials add on top of
 * quantity × price.
 */
export const ComposerLineSheet = ({
  open,
  onOpenChange,
  services,
  companyId,
  servicesLoading,
  initialLine,
  onSubmit,
  documentLabel = 'ticket',
}: ComposerLineSheetProps) => {
  const [materials, setMaterials] = useState<MaterialDraft[]>(
    () => initialLine?.materials ?? [],
  );
  // Once the user edits materials, picking another service asks before replacing them.
  const [materialsEdited, setMaterialsEdited] = useState(
    () => (initialLine?.materials?.length ?? 0) > 0,
  );
  const [pendingDefaults, setPendingDefaults] = useState<ComposerService | null>(null);
  const [step, setStep] = useState<SheetStep>({ kind: 'line' });
  const materialEntry = useMaterialEntry('line', null);
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

  const materialsTotal = materialDraftsTotal(materials);
  const serviceAmount = multiplyMoney(priceValue, quantityValue);
  const lineTotal = addMoney(serviceAmount, materialsTotal);

  const updateMaterials = (next: MaterialDraft[]) => {
    setMaterials(next);
    setMaterialsEdited(true);
    setPendingDefaults(null);
  };

  const applyDefaults = (match: ComposerService) => {
    setMaterials(materialDraftsFromServiceDefaults(match.materials));
    setMaterialsEdited(false);
    setPendingDefaults(null);
  };

  const handleServiceChange = (value: string) => {
    setServiceId(value);
    const match = services.find((item) => String(item.id) === value);
    if (match) {
      setPrice(String(servicePrice(match)));
      const defaults = match.materials ?? [];
      if (!materialsEdited || materials.length === 0) {
        applyDefaults(match);
      } else if (defaults.length > 0) {
        // The user already shaped this line's materials: ask before replacing.
        setPendingDefaults(match);
      }
    }
  };

  const openMaterialStep = (editing: MaterialDraft | null) => {
    materialEntry.reset(editing);
    setStep({ kind: 'material', editing });
  };

  const submitMaterial = () => {
    if (!materialEntry.canSubmit) return;
    const draft = materialEntry.toDraft();
    const exists = materials.some((item) => item.key === draft.key);
    updateMaterials(
      exists
        ? materials.map((item) => (item.key === draft.key ? draft : item))
        : [...materials, draft],
    );
    setStep({ kind: 'line' });
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
        ...(materials.length > 0 ? { materials } : {}),
      });
    } else {
      onSubmit({
        kind: 'catalog',
        service_id: selectedService?.id ?? editingCatalogLine!.service_id,
        service_name: selectedService?.name ?? editingCatalogLine!.service_name,
        quantity: quantityValue,
        price: priceValue,
        ...(materials.length > 0 ? { materials } : {}),
      });
    }
    onOpenChange(false);
  };

  if (step.kind === 'material') {
    const editingMaterial = step.editing;
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={editingMaterial ? 'Editar material' : 'Agregar material'}
        description={
          materialEntry.mode === 'custom'
            ? `Escríbelo aquí. Sólo vive en este ${documentLabel} si no lo guardas en tu catálogo.`
            : 'Búscalo en tu catálogo de materiales.'
        }
        data-testid="composer-material-step"
        footer={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => setStep({ kind: 'line' })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
              Volver
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              disabled={!materialEntry.canSubmit}
              onClick={submitMaterial}
            >
              {editingMaterial ? 'Guardar material' : 'Agregar material'}
            </Button>
          </div>
        }
      >
        <MaterialEntryFields
          idPrefix="composer-material"
          entry={materialEntry}
          companyId={companyId}
          documentLabel={documentLabel}
          autoFocus={!editingMaterial}
        />
      </BottomSheet>
    );
  }

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

        <section aria-labelledby="composer-line-materials-heading" className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              id="composer-line-materials-heading"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
              Materiales
            </h3>
            {materials.length > 0 ? (
              <span className="text-sm font-semibold tabular-nums">
                {formatServiceCurrency(materialsTotal)}
              </span>
            ) : null}
          </div>
          {pendingDefaults ? (
            <div
              role="status"
              className="space-y-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
            >
              <p className="text-sm">
                {pendingDefaults.name} trae{' '}
                {(pendingDefaults.materials?.length ?? 0) === 1
                  ? '1 material'
                  : `${pendingDefaults.materials?.length ?? 0} materiales`}
                . ¿Reemplazar los tuyos?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-11 flex-1"
                  onClick={() => applyDefaults(pendingDefaults)}
                >
                  Reemplazar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => setPendingDefaults(null)}
                >
                  Mantener
                </Button>
              </div>
            </div>
          ) : null}
          {materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin materiales. Se suman al precio del servicio.
            </p>
          ) : null}
          <MaterialRows
            materials={materials}
            showInlineChips
            onEdit={(key) =>
              openMaterialStep(materials.find((item) => item.key === key) ?? null)
            }
            onRemove={(key) => updateMaterials(materials.filter((item) => item.key !== key))}
            data-testid="composer-line-material-rows"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={materials.length >= MATERIALS_PER_LINE_MAX}
            onClick={() => openMaterialStep(null)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
            Agregar material
          </Button>
        </section>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subtotal
            </p>
            <p
              className="truncate text-xs tabular-nums text-muted-foreground"
              data-testid="composer-line-breakdown"
            >
              {materials.length > 0
                ? `Servicio ${formatServiceCurrency(serviceAmount)} · Materiales ${formatServiceCurrency(materialsTotal)}`
                : `${quantityValue} × ${formatServiceCurrency(priceValue)}`}
            </p>
          </div>
          <NumberTicker
            value={lineTotal}
            format={formatServiceCurrency}
            className="shrink-0 text-lg font-semibold text-foreground"
            data-testid="composer-line-subtotal"
          />
        </div>
      </div>
    </BottomSheet>
  );
};
