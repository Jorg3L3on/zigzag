'use client';

import { useState } from 'react';
import type { Service } from '@/db/schema';
import { LineMaterialsEditor } from '@/components/materials/line-materials-editor';
import { materialDraftsTotal, type MaterialDraft } from '@/lib/material-drafts';
import {
  InlineServiceFields,
  ServiceLineModeToggle,
  type ServiceLineMode,
} from '@/components/tickets/service-line-source-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatServiceCurrency,
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';
import { NumberTicker } from '@/components/motion';
import { addMoney, multiplyMoney } from '@/lib/money';
import { CheckCircle2, Loader2, Minus, Plus, PlusCircle } from 'lucide-react';

type TicketAddServicePanelProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  filteredServices: Service[];
  selectedService: string;
  onServiceSelect: (serviceId: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  onQuantityAdjust: (nextValue: number) => void;
  price: string;
  onPriceChange: (value: string) => void;
  onPriceAdjust: (nextValue: number) => void;
  lineMode: ServiceLineMode;
  onLineModeChange: (mode: ServiceLineMode) => void;
  customName: string;
  onCustomNameChange: (value: string) => void;
  customDescription: string;
  onCustomDescriptionChange: (value: string) => void;
  saveToCatalog: boolean;
  onSaveToCatalogChange: (value: boolean) => void;
  /** Materials of the line being added (ZIG-I10); prefilled from the service. */
  materials: MaterialDraft[];
  onMaterialsChange: (next: MaterialDraft[]) => void;
  companyId?: number | null;
  /** Noun for copy ("ticket" / "presupuesto"). */
  documentLabel?: string;
  isSubmitting: boolean;
  onAddService: () => void;
};

export const TicketAddServicePanel = ({
  isOpen,
  onOpenChange,
  filteredServices,
  selectedService,
  onServiceSelect,
  searchTerm,
  onSearchTermChange,
  quantity,
  onQuantityChange,
  onQuantityAdjust,
  price,
  onPriceChange,
  onPriceAdjust,
  lineMode,
  onLineModeChange,
  customName,
  onCustomNameChange,
  customDescription,
  onCustomDescriptionChange,
  saveToCatalog,
  onSaveToCatalogChange,
  materials,
  onMaterialsChange,
  companyId,
  documentLabel = 'ticket',
  isSubmitting,
  onAddService,
}: TicketAddServicePanelProps) => {
  // While a material is being typed, its own buttons replace Agregar al ticket.
  const [materialEntryOpen, setMaterialEntryOpen] = useState(false);
  const serviceAmount = multiplyMoney(sanitizeDecimal(price), sanitizeInteger(quantity));
  const materialsAmount = materialDraftsTotal(materials);
  return (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button className="w-full sm:w-auto">
        <PlusCircle className="mr-2 h-5 w-5" data-icon="inline-start" />
        Agregar servicio
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-lg">
      <DialogHeader>
        <DialogTitle
          data-initial-focus
          tabIndex={-1}
          className="text-2xl font-semibold text-foreground outline-none focus:outline-none"
        >
          {`Agregar servicio al ${documentLabel}`}
        </DialogTitle>
        <DialogDescription>
          {lineMode === 'custom'
            ? `Escríbelo aquí. Sólo vive en este ${documentLabel} si no lo guardas en tu catálogo.`
            : `Selecciona un servicio de tu catálogo. Define cantidad y precio para agregarlo al ${documentLabel}.`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-6 py-4">
        <ServiceLineModeToggle
          idPrefix="ticket-add-service"
          value={lineMode}
          onValueChange={onLineModeChange}
        />
        {lineMode === 'custom' ? (
          <InlineServiceFields
            idPrefix="ticket-add-service"
            name={customName}
            onNameChange={onCustomNameChange}
            description={customDescription}
            onDescriptionChange={onCustomDescriptionChange}
            saveToCatalog={saveToCatalog}
            onSaveToCatalogChange={onSaveToCatalogChange}
            documentLabel={documentLabel}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-3">
                <Label
                  htmlFor="ticket-add-service-select"
                  className="text-sm font-medium text-foreground"
                >
                  Servicio
                </Label>
                <Select value={selectedService} onValueChange={onServiceSelect}>
                  <SelectTrigger
                    id="ticket-add-service-select"
                    aria-label="Servicio"
                    className="h-auto min-h-12 w-full items-start whitespace-normal border-2 py-2 transition-colors focus:border-primary [&>span]:block [&>span]:max-w-[calc(100%-1.5rem)] [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left"
                  >
                    <SelectValue placeholder="Seleccione un servicio" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-3rem)]">
                    <div className="flex items-center px-3 pb-2">
                      <Input
                        id="ticket-add-service-search"
                        placeholder="Buscar servicio..."
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        className="h-9"
                        aria-label="Buscar servicio"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {filteredServices.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No se encontraron servicios
                        </div>
                      ) : (
                        filteredServices.map((service) => (
                          <SelectItem
                            key={service.id}
                            value={service.id.toString()}
                            textValue={service.name}
                            className="items-start whitespace-normal py-2"
                          >
                            <span className="block whitespace-normal break-words pr-2 leading-snug">
                              {service.name}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label
              htmlFor="ticket-add-service-quantity"
              className="text-sm font-medium text-foreground"
            >
              Cantidad
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => onQuantityAdjust(sanitizeInteger(quantity) - 1)}
                aria-label="Reducir cantidad"
              >
                <Minus className="h-4 w-4" data-icon="inline-start" />
              </Button>
              <Input
                id="ticket-add-service-quantity"
                type="number"
                min="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) =>
                  onQuantityChange(e.target.value.replace(/[^\d]/g, ''))
                }
                onBlur={() => onQuantityAdjust(sanitizeInteger(quantity))}
                className="h-12 border-2 text-center transition-colors focus:border-primary"
                aria-label="Cantidad"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => onQuantityAdjust(sanitizeInteger(quantity) + 1)}
                aria-label="Aumentar cantidad"
              >
                <Plus className="h-4 w-4" data-icon="inline-start" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="ticket-add-service-price"
              className="text-sm font-medium text-foreground"
            >
              Precio
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() =>
                  onPriceAdjust(Number((sanitizeDecimal(price) - 1).toFixed(2)))
                }
                aria-label="Reducir precio"
              >
                <Minus className="h-4 w-4" data-icon="inline-start" />
              </Button>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="ticket-add-service-price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => onPriceChange(e.target.value)}
                  onBlur={() => onPriceAdjust(sanitizeDecimal(price))}
                  className="h-12 border-2 pl-8 text-center transition-colors focus:border-primary"
                  aria-label="Precio"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() =>
                  onPriceAdjust(Number((sanitizeDecimal(price) + 1).toFixed(2)))
                }
                aria-label="Aumentar precio"
              >
                <Plus className="h-4 w-4" data-icon="inline-start" />
              </Button>
            </div>
          </div>
        </div>

        <LineMaterialsEditor
          idPrefix="ticket-add-service-materials"
          value={materials}
          onChange={onMaterialsChange}
          companyId={companyId}
          documentLabel={documentLabel}
          onEntryOpenChange={setMaterialEntryOpen}
        />

        <div
          data-testid="ticket-add-service-subtotal"
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subtotal
            </p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {materials.length > 0
                ? `Servicio ${formatServiceCurrency(serviceAmount)} · Materiales ${formatServiceCurrency(materialsAmount)}`
                : `${sanitizeInteger(quantity)} × ${formatServiceCurrency(sanitizeDecimal(price))}`}
            </p>
          </div>
          <NumberTicker
            value={addMoney(serviceAmount, materialsAmount)}
            format={formatServiceCurrency}
            className="shrink-0 text-lg font-semibold text-foreground"
            data-testid="ticket-add-service-subtotal-value"
          />
        </div>

        {materialEntryOpen ? null : (
        <Button
          type="button"
          onClick={onAddService}
          className="h-12 w-full font-medium"
          disabled={
            isSubmitting ||
            (lineMode === 'custom' ? !customName.trim() : !selectedService)
          }
        >
          {isSubmitting ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                data-icon="inline-start"
              />
              Agregando servicio...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" data-icon="inline-start" />
              {`Agregar al ${documentLabel}`}
            </>
          )}
        </Button>
        )}
      </div>
    </DialogContent>
  </Dialog>
  );
};
