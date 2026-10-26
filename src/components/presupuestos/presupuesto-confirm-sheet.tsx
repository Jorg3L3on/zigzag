'use client';

import { ConfirmSheet } from '@/components/documents/confirm-sheet';

export type PresupuestoConfirmKind = 'convert' | 'cancel';

/** Convertir and Cancelar behind a confirmation (ZIG-I5-4), from the detail or the list. */
export const PresupuestoConfirmSheet = ({
  kind,
  docLabel,
  pending,
  onClose,
  onConfirm,
}: {
  kind: PresupuestoConfirmKind | null;
  docLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (kind: PresupuestoConfirmKind) => void;
}) => (
  <ConfirmSheet
    open={kind !== null}
    onOpenChange={(open) => {
      if (!open && !pending) onClose();
    }}
    title={
      kind === 'convert'
        ? `¿Convertir el presupuesto ${docLabel} en ticket?`
        : `¿Cancelar el presupuesto ${docLabel}?`
    }
    description={
      kind === 'convert'
        ? 'Se crea un ticket de trabajo con los mismos servicios y precios. El presupuesto queda como Aceptado.'
        : 'Sale de los presupuestos abiertos y queda sólo para consulta. No se puede deshacer.'
    }
    confirmLabel={kind === 'convert' ? 'Convertir a ticket' : 'Cancelar presupuesto'}
    cancelLabel="Volver"
    destructive={kind === 'cancel'}
    pending={pending}
    onConfirm={() => {
      if (kind) onConfirm(kind);
    }}
  />
);
