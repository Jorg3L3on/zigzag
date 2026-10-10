import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPresupuestoById } from '@/actions/presupuestos';
import { DocumentPdfViewer } from '@/components/pdf/document-pdf-viewer';
import { QuoteSummary, formatLongDate } from '@/components/tickets/review/document-review-parts';
import { requirePagePermission } from '@/lib/page-authz';
import { buildPresupuestoViewProps } from '@/lib/presupuesto-view-props';
import { PRESUPUESTO_STATUS_LABEL } from '@/lib/ticket-document-kind';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  return { title: `Presupuesto #${id} · PDF` };
};

/**
 * In-app PDF viewer for a presupuesto (ZIG-I9-1): the app bar's back arrow returns
 * to the detail instead of leaving the PWA through a raw PDF response.
 */
export default async function PresupuestoPdfPage({
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
  return (
    <DocumentPdfViewer
      ticketId={props.presupuestoId}
      kind="presupuesto"
      title={`Presupuesto #${props.presupuestoId}`}
      subtitle={PRESUPUESTO_STATUS_LABEL[props.status]}
      backHref={`/presupuestos/${props.presupuestoId}`}
      backLabel="Volver al presupuesto"
      downloadFileName={props.downloadFileName}
      summary={
        <QuoteSummary
          presupuestoId={props.presupuestoId}
          clientName={props.clientName}
          dateLabel={formatLongDate(props.ticketDate)}
          expiresLabel={formatLongDate(props.expiresAt)}
          lines={props.lines}
          total={props.total}
        />
      }
      whatsApp={{
        kind: 'presupuesto',
        phone: props.clientTel,
        clientName: props.clientName,
        total: props.total,
        servicesSummary: props.lines
          .slice(0, 3)
          .map((line) => line.name)
          .join(', '),
        validUntil: props.expiresAt,
      }}
    />
  );
}
