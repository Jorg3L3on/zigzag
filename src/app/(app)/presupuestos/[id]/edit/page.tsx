import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getPresupuestoById } from '@/actions/presupuestos';
import { PresupuestoEditComposer } from '@/components/presupuestos/presupuesto-composer';
import { requirePagePermission } from '@/lib/page-authz';
import { buildPresupuestoEditState } from '@/lib/presupuesto-view-props';
import { isPresupuestoMutable } from '@/lib/ticket-document-kind';

export const metadata: Metadata = { title: 'Editar presupuesto' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Editar presupuesto (ZIG-I5-5): open or expired quotes only. */
export default async function EditPresupuestoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.write');
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) notFound();

  const result = await getPresupuestoById(numericId);
  if (!result.success) notFound();
  if (!isPresupuestoMutable(result.data)) {
    redirect(`/presupuestos/${String(result.data.id)}`);
  }

  return <PresupuestoEditComposer edit={buildPresupuestoEditState(result.data)} />;
}
