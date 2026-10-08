'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import type { Service } from '@/db/schema';
import { BottomSheet, NumberTicker } from '@/components/motion';
import { ServiceForm } from '@/components/services/service-form';
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
  onServiceCreated: (service: Service) => void;
};

const servicePrice = (item: Service | undefined): number =>
  item ? roundMoney(Number(item.price) || 0) : 0;

/**
 * Add / edit one composer line: service + Cantidad × Precio with a live
 * subtotal. Mount it with a fresh `key` per open so the form starts clean.
 */
export const ComposerLineSheet = ({
  open,
  onOpenChange,
  services,
  servicesLoading,
  initialLine,
  onSubmit,
  onServiceCreated,
}: ComposerLineSheetProps) => {
  const [serviceId, setServiceId] = useState(
    initialLine ? String(initialLine.service_id) : '',
  );
  const [quantity, setQuantity] = useState(
    initialLine ? String(initialLine.quantity) : '1',
  );
  const [price, setPrice] = useState(
    initialLine ? String(initialLine.price) : '',
  );
  const [isCreatingService, setIsCreatingService] = useState(false);

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

  const handleServiceChange = (value: string) => {
    setServiceId(value);
    const match = services.find((item) => String(item.id) === value);
    if (match) {
      setPrice(String(servicePrice(match)));
    }
  };

  const handleSubmit = () => {
    if (!selectedService && !initialLine) return;
    onSubmit({
      service_id: selectedService?.id ?? initialLine!.service_id,
      service_name: selectedService?.name ?? initialLine!.service_name,
      quantity: quantityValue,
      price: priceValue,
    });
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        isCreatingService
          ? 'Nuevo servicio'
          : isEditing
            ? 'Editar servicio'
            : 'Agregar servicio'
      }
      description={
        isCreatingService
          ? 'Se guarda en tu catálogo y lo podrás agregar a este ticket.'
          : 'Elige el servicio, la cantidad y el precio.'
      }
      data-testid="composer-line-sheet"
      footer={
        isCreatingService ? undefined : (
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
              disabled={!selectedService && !initialLine}
              onClick={handleSubmit}
            >
              {isEditing ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </div>
        )
      }
    >
      {isCreatingService ? (
        <ServiceForm
          onCancel={() => setIsCreatingService(false)}
          onSuccess={(saved) => {
            onServiceCreated(saved);
            setServiceId(String(saved.id));
            setPrice(String(servicePrice(saved)));
            setIsCreatingService(false);
          }}
        />
      ) : (
        <div className="space-y-4">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2 text-primary"
              onClick={() => setIsCreatingService(true)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo servicio
            </Button>
          </div>

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
      )}
    </BottomSheet>
  );
};
