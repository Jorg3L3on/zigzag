import type { ServiceTicket } from '@/actions/ticket-services';
import { Button } from '@/components/ui/button';
import { TicketServiceRow } from '@/components/tickets/ticket-service-row';
import {
  calculateServicesTotal,
  formatServiceCurrency,
} from '@/components/tickets/ticket-services-utils';
import { Receipt } from 'lucide-react';

type TicketServicesTableProps = {
  ticketId: string;
  ticketServices: ServiceTicket[];
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
  onBack: () => void;
  onContinue: () => void;
};

export const TicketServicesTable = ({
  ticketServices,
  onUpdate,
  onQuantityInput,
  onPriceInput,
  onDelete,
  onBack,
  onContinue,
}: TicketServicesTableProps) => (
  <>
    {ticketServices.map((serviceTicket) => (
      <TicketServiceRow
        key={serviceTicket.id}
        serviceTicket={serviceTicket}
        onUpdate={onUpdate}
        onQuantityInput={onQuantityInput}
        onPriceInput={onPriceInput}
        onDelete={onDelete}
      />
    ))}

    {ticketServices.length === 0 && (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
        <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            No hay servicios asignados a este ticket
          </p>
          <p>
            Usa <span className="font-semibold">Agregar servicio</span> para
            añadir el primero.
          </p>
        </div>
      </div>
    )}

    <div className="mt-8 border-t border-border/60 pt-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {formatServiceCurrency(calculateServicesTotal(ticketServices))}
        </span>
      </div>
    </div>

    <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full sm:w-auto"
        onClick={onBack}
      >
        Volver a datos del ticket
      </Button>
      <Button
        type="button"
        className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold text-white shadow-md transition-colors hover:from-blue-700 hover:to-purple-700 sm:w-auto"
        disabled={ticketServices.length === 0}
        onClick={onContinue}
      >
        Continuar a revisión
      </Button>
    </div>
  </>
);
