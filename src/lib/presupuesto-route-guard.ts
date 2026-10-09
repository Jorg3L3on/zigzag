import { redirect } from 'next/navigation';

import { getPresupuestoById } from '@/actions/presupuestos';

/**
 * Ticket-only pages (edit, services) send a presupuesto to its own detail page
 * (ZIG-I5-4); quotes are edited in /presupuestos/[id]/edit.
 */
export const redirectPresupuestoToOwnPage = async (rawId: string): Promise<void> => {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const result = await getPresupuestoById(id);
  if (result.success) {
    redirect(`/presupuestos/${String(result.data.id)}`);
  }
};
