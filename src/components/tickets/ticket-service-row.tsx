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
import { addMoney, multiplyMoney, roundMoney } from '@/lib/money';
import { MoreVertical, Package, Pencil, Trash2 } from 'lucide-react';
import { LineMaterialsEditor } from '@/components/materials/line-materials-editor';
import { ReviewLineMaterials } from '@/components/tickets/review/document-review-parts';
import { useCompany } from '@/contexts/company-context';
import {
  materialDraftsFromStoredRows,
  materialDraftsTotal,
  type MaterialDraft,
} from '@/lib/material-drafts';
import { buildReviewLine } from '@/lib/review-lines';
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
    /** Whole new material set (ZIG-I10); omitted = unchanged. */
    materials?: MaterialDraft[],
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
            value={addMoney(
              multiplyMoney(price, quantity),
              materialDraftsTotal(serviceTicket.materials),
            )}
            format={formatServiceCurrency}
            className="text-lg font-semibold text-foreground"
            data-testid="ticket-service-edit-subtotal"
          />
        </div>
      </div>
    </BottomSheet>
  );
};

type TicketLineMaterialsSheetProps = {
  serviceTicket: ServiceTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (materials: MaterialDraft[]) => void;
};

/** Materiales of a saved line (ZIG-I10-4): edit the set, then Guardar replaces it. */
const TicketLineMaterialsSheet = ({
  serviceTicket,
  open,
  onOpenChange,
  onSave,
}: TicketLineMaterialsSheetProps) => {
  const { selectedCompany } = useCompany();
  const [materials, setMaterials] = useState<MaterialDraft[]>(() =>
    materialDraftsFromStoredRows(serviceTicket.materials),
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const name = getServiceLineName(serviceTicket);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Materiales de ${name}`}
      description="Se suman al precio del servicio en este ticket."
      data-testid="ticket-line-materials-sheet"
      footer={
        entryOpen ? null : (
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
              onClick={() => {
                onSave(materials);
                onOpenChange(false);
              }}
            >
              Guardar
            </Button>
          </div>
        )
      }
    >
      <LineMaterialsEditor
        idPrefix={`ticket-line-materials-${serviceTicket.id}`}
        value={materials}
        onChange={setMaterials}
        companyId={selectedCompany?.id}
        onEntryOpenChange={setEntryOpen}
      />
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
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialsSession, setMaterialsSession] = useState(0);
  const name = getServiceLineName(serviceTicket);
  const description = getServiceLineDescription(serviceTicket);
  const materialCount = serviceTicket.materials?.length ?? 0;
  // Service amount plus its materials (ZIG-I10).
  const subtotal = addMoney(
    multiplyMoney(serviceTicket.price, serviceTicket.quantity),
    materialDraftsTotal(serviceTicket.materials),
  );
  const openMaterials = () => {
    setMaterialsSession((session) => session + 1);
    setMaterialsOpen(true);
  };

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
              <DropdownMenuItem onSelect={openMaterials}>
                <Package className="h-4 w-4" aria-hidden />
                Materiales{materialCount > 0 ? ` (${materialCount})` : ''}
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

      {/* Full row width so names and amounts never squeeze beside the menu (ZIG-I10). */}
      <ReviewLineMaterials
        materials={buildReviewLine(serviceTicket).materials}
        showInlineChips
      />

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
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 self-end"
            onClick={openMaterials}
          >
            <Package className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
            Materiales{materialCount > 0 ? ` (${materialCount})` : ''}
          </Button>
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

      <TicketLineMaterialsSheet
        key={`materials-${materialsSession}`}
        serviceTicket={serviceTicket}
        open={materialsOpen}
        onOpenChange={setMaterialsOpen}
        onSave={(materials) =>
          onUpdate(serviceTicket.id, serviceTicket.quantity, serviceTicket.price, materials)
        }
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
