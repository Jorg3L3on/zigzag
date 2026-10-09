'use client';

import { useState } from 'react';
import type { ServiceTicket } from '@/actions/ticket-services';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BottomSheet, NumberTicker } from '@/components/motion';
import { TripledNativeDelete } from '@/components/tripled';
import { TicketServiceLineEditor } from '@/components/tickets/ticket-service-line-editor';
import {
  formatServiceCurrency,
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';
import { multiplyMoney, roundMoney } from '@/lib/money';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { InlineLineChips } from '@/components/tickets/service-line-source-fields';
import {
  getServiceLineDescription,
  getServiceLineName,
} from '@/lib/service-line-display';

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

type LineDraft = { quantity: string; price: string };

type TicketServiceEditSheetProps = {
  serviceTicket: ServiceTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quantity: number, price: number) => void;
};

/** Mobile Editar: the row's steppers in a bottom sheet over a local draft. */
const TicketServiceEditSheet = ({
  serviceTicket,
  open,
  onOpenChange,
  onSave,
}: TicketServiceEditSheetProps) => {
  const [draft, setDraft] = useState<LineDraft>({
    quantity: String(serviceTicket.quantity),
    price: String(serviceTicket.price),
  });

  const quantity = sanitizeInteger(draft.quantity);
  const price = roundMoney(sanitizeDecimal(draft.price));

  const handleSave = () => {
    onSave(quantity, price);
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Editar ${getServiceLineName(serviceTicket)}`}
      description="Ajusta cantidad y precio de esta línea."
      data-testid="ticket-service-edit-sheet"
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
          <Button type="button" className="h-11 flex-1" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <TicketServiceLineEditor
          idPrefix={`ticket-service-sheet-${serviceTicket.id}`}
          quantity={draft.quantity}
          price={draft.price}
          onQuantityStep={(next) =>
            setDraft((current) => ({ ...current, quantity: String(next) }))
          }
          onPriceStep={(next) =>
            setDraft((current) => ({ ...current, price: String(next) }))
          }
          onQuantityInput={(value) =>
            setDraft((current) => ({
              ...current,
              quantity: value.replace(/[^\d]/g, ''),
            }))
          }
          onPriceInput={(value) =>
            setDraft((current) => ({ ...current, price: value }))
          }
        />
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Subtotal
          </span>
          <NumberTicker
            value={multiplyMoney(price, quantity)}
            format={formatServiceCurrency}
            className="text-lg font-semibold text-foreground"
            data-testid="ticket-service-edit-subtotal"
          />
        </div>
      </div>
    </BottomSheet>
  );
};

export const TicketServiceRow = ({
  serviceTicket,
  onUpdate,
  onQuantityInput,
  onPriceInput,
  onDelete,
}: TicketServiceRowProps) => {
  const [editOpen, setEditOpen] = useState(false);
  // New key per Editar so the sheet's draft starts from the saved line, while
  // staying mounted after close so the exit animation can play.
  const [editSession, setEditSession] = useState(0);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const name = getServiceLineName(serviceTicket);
  const description = getServiceLineDescription(serviceTicket);
  const subtotal = multiplyMoney(serviceTicket.price, serviceTicket.quantity);

  return (
    <div
      data-testid="ticket-service-row"
      className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow duration-200 hover:border-border hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium text-foreground">
            <span>{name}</span>
            <InlineLineChips isInline={serviceTicket.service_id == null} />
          </h3>
          <p
            data-testid="ticket-service-row-summary"
            className="mt-0.5 text-sm tabular-nums text-muted-foreground sm:hidden"
          >
            {serviceTicket.quantity} × {formatServiceCurrency(serviceTicket.price)}
          </p>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:hidden">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatServiceCurrency(subtotal)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground"
                aria-label={`Opciones de ${name}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEditSession((session) => session + 1);
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Quitar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 hidden space-y-3 sm:block">
        <TicketServiceLineEditor
          idPrefix={`ticket-service-${serviceTicket.id}`}
          quantity={serviceTicket.quantity}
          price={serviceTicket.price}
          onQuantityStep={(next) =>
            onUpdate(serviceTicket.id, next, serviceTicket.price)
          }
          onPriceStep={(next) =>
            onUpdate(serviceTicket.id, serviceTicket.quantity, next)
          }
          onQuantityInput={(value) =>
            onQuantityInput(serviceTicket.id, serviceTicket.price, value)
          }
          onPriceInput={(value) =>
            onPriceInput(serviceTicket.id, serviceTicket.quantity, value)
          }
        />
        <div className="flex min-w-0 items-end justify-end gap-3">
          <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 p-3 text-right">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subtotal
            </Label>
            <p className="whitespace-nowrap text-xs font-semibold tabular-nums leading-tight text-foreground sm:text-base">
              {formatServiceCurrency(subtotal)}
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

      <TicketServiceEditSheet
        key={editSession}
        serviceTicket={serviceTicket}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(quantity, price) => onUpdate(serviceTicket.id, quantity, price)}
      />

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {name} del ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              La línea se elimina del ticket. El servicio sigue en tu catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(serviceTicket.id)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
