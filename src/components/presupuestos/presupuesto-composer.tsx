'use client';

import { DocumentComposer } from '@/components/tickets/composer/ticket-composer';

/**
 * Nuevo presupuesto (ZIG-I5-3): the ticket composer with Vence, its own draft
 * and createPresupuestoWithLines. Nothing is persisted before Guardar presupuesto.
 */
export const PresupuestoComposer = () => <DocumentComposer kind="presupuesto" />;
