'use client';

import {
  DocumentComposer,
  type ComposerEditState,
} from '@/components/tickets/composer/ticket-composer';

/**
 * Nuevo presupuesto (ZIG-I5-3): the ticket composer with Vence, its own draft
 * and createPresupuestoWithLines. Nothing is persisted before Guardar presupuesto.
 */
export const PresupuestoComposer = () => <DocumentComposer kind="presupuesto" />;

/** Editar presupuesto (ZIG-I5-5): the same composer loaded with an open quote. */
export const PresupuestoEditComposer = ({ edit }: { edit: ComposerEditState }) => (
  <DocumentComposer kind="presupuesto" edit={edit} />
);
