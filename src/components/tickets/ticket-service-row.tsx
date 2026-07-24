import type { ServiceTicket } from '@/actions/ticket-services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TripledNativeDelete } from '@/components/tripled';
import { Minus, Plus } from 'lucide-react';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';

type TicketServiceRowProps = {
  serviceTicket: ServiceTicket;
  onUpdate: (
    serviceTicketId: number,
    quantity: number,
    price: number,
  ) => void;
  onQuantityInput: (
    serviceTicketId: number,
    currentPrice: number,
    value: string,
  ) => void;
  onPriceInput: (
    serviceTicketId: number,
    currentQuantity: number,
    value: string,
  ) => void;
  onDelete: (serviceTicketId: number) => void;
};

export const TicketServiceRow = ({
  serviceTicket,
  onUpdate,
  onQuantityInput,
  onPriceInput,
  onDelete,
}: TicketServiceRowProps) => (
  <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow duration-200 hover:border-border hover:shadow-md">
    <div className="space-y-4">
      <h3 className="font-medium text-foreground">{serviceTicket.service.name}</h3>
      <p className="text-sm text-muted-foreground">
        {serviceTicket.service.description}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <div>
          <Label
            htmlFor={`ticket-service-quantity-${serviceTicket.id}`}
            className="text-sm font-medium text-foreground"
          >
            Cantidad
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() =>
                onUpdate(
                  serviceTicket.id,
                  Math.max(serviceTicket.quantity - 1, 1),
                  serviceTicket.price,
                )
              }
              aria-label="Reducir cantidad del servicio"
            >
              <Minus className="h-4 w-4" data-icon="inline-start"/>
            </Button>
            <Input
              id={`ticket-service-quantity-${serviceTicket.id}`}
              type="number"
              min="1"
              inputMode="numeric"
              pattern="[0-9]*"
              value={serviceTicket.quantity}
              onChange={(e) =>
                onQuantityInput(
                  serviceTicket.id,
                  serviceTicket.price,
                  e.target.value,
                )
              }
              className="w-full text-center sm:w-24"
              aria-label="Cantidad del servicio"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() =>
                onUpdate(
                  serviceTicket.id,
                  serviceTicket.quantity + 1,
                  serviceTicket.price,
                )
              }
              aria-label="Aumentar cantidad del servicio"
            >
              <Plus className="h-4 w-4" data-icon="inline-start"/>
            </Button>
          </div>
        </div>
        <div>
          <Label
            htmlFor={`ticket-service-price-${serviceTicket.id}`}
            className="text-sm font-medium text-foreground"
          >
            Precio
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() =>
                onUpdate(
                  serviceTicket.id,
                  serviceTicket.quantity,
                  Math.max(Number((serviceTicket.price - 1).toFixed(2)), 0),
                )
              }
              aria-label="Reducir precio del servicio"
            >
              <Minus className="h-4 w-4" data-icon="inline-start"/>
            </Button>
            <div className="relative w-full sm:w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`ticket-service-price-${serviceTicket.id}`}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={serviceTicket.price}
                onChange={(e) =>
                  onPriceInput(
                    serviceTicket.id,
                    serviceTicket.quantity,
                    e.target.value,
                  )
                }
                className="w-full pl-8 text-center"
                aria-label="Precio del servicio"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() =>
                onUpdate(
                  serviceTicket.id,
                  serviceTicket.quantity,
                  Number((serviceTicket.price + 1).toFixed(2)),
                )
              }
              aria-label="Aumentar precio del servicio"
            >
              <Plus className="h-4 w-4" data-icon="inline-start"/>
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 items-end justify-end gap-3 sm:col-span-2">
          <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 p-3 text-right">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subtotal
            </Label>
            <p className="whitespace-nowrap text-xs font-semibold tabular-nums leading-tight text-foreground sm:text-base">
              {formatServiceCurrency(
                serviceTicket.quantity * serviceTicket.price,
              )}
            </p>
          </div>
          <TripledNativeDelete
            onDelete={() => onDelete(serviceTicket.id)}
            iconOnly
            buttonText="Eliminar servicio"
            confirmLabel="Sí, eliminar"
            className="mt-0 self-end"
          />
        </div>
      </div>
    </div>
  </div>
);
