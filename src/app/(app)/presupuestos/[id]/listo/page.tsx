import { redirect } from 'next/navigation';

import { requirePagePermission } from '@/lib/page-authz';

/**
 * The creation review is gone (ZIG-I24-4): Guardar presupuesto lands on the
 * detail, which has the PDF, Compartir and Convertir. Old links go there too.
 */
export default async function PresupuestoReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  redirect(`/presupuestos/${encodeURIComponent(id)}`);
}
