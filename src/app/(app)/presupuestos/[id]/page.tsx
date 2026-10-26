import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPresupuestoById } from '@/actions/presupuestos';
import { getTicketAuditHistory } from '@/actions/tickets';
import { PresupuestoView } from '@/components/presupuestos/presupuesto-view';
import { TripledPageHeader } from '@/components/tripled';
import { requirePagePermission } from '@/lib/page-authz';
import { buildPresupuestoViewProps } from '@/lib/presupuesto-view-props';

export const metadata: Metadata = { title: 'Presupuesto' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Presupuesto detail (ZIG-I5-4): status, lines, PDF, Compartir, Convertir, Cancelar. */
export default async function PresupuestoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.read');
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) notFound();

  const result = await getPresupuestoById(numericId);
  if (!result.success) notFound();

  const props = buildPresupuestoViewProps(result.data);
  const audit = await getTicketAuditHistory(numericId);
  const isMutable = props.status === 'abierto' || props.status === 'vencido';
  return (
    <>
      {/* Desktop only (canvas PresuA); the phone keeps its own app bar. */}
      <TripledPageHeader
        className="hidden lg:flex"
        items={[
          { label: 'Presupuestos', href: '/presupuestos' },
          { label: `Presupuesto ${props.folio || `#${props.presupuestoId}`}` },
        ]}
      />
      <PresupuestoView
        {...props}
        editHref={isMutable ? `/presupuestos/${props.presupuestoId}/edit` : null}
        activity={audit.success ? (audit.data ?? []) : []}
      />
    </>
  );
}
