'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
  type PresupuestoConvertedTicket,
} from '@/actions/presupuestos';
import { PresupuestoConfirmSheet } from '@/components/presupuestos/presupuesto-confirm-sheet';
import { PresupuestoDetailLayout } from '@/components/presupuestos/presupuesto-detail-layout';
import { PresupuestoExtendDialog } from '@/components/presupuestos/presupuesto-extend-dialog';
import { usePresupuestoDuplicate } from '@/components/presupuestos/use-presupuesto-duplicate';
import type { PresupuestoActivityEntry } from '@/components/presupuestos/presupuesto-desktop';
import type { ReviewLine } from '@/components/tickets/review/document-review-parts';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import {
  downloadTicketInvoiceFile,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { canDownloadTicketInvoice, canWriteTickets } from '@/lib/tickets-rbac';
import { buildWhatsAppQuoteShare } from '@/lib/whatsapp-share';

export type PresupuestoViewProps = {
  presupuestoId: string;
  /** Company folio (P-0003); falls back to `#id`. */
  folio?: string | null;
  clientId: number | null;
  clientName: string | null;
  clientTel: string | null;
  /** Phone on the client record. The desktop card falls back to `clientTel`. */
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  ticketDate: string | null;
  expiresAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  workNotes: string | null;
  total: number;
  lines: ReviewLine[];
  status: PresupuestoStatus;
  convertedToTicketId: string | null;
  downloadFileName: string;
  /** Editar shows only when the edit route exists (ZIG-I5-5). */
  editHref?: string | null;
  /** Newest first. The desktop activity card shows the latest four. */
  activity?: PresupuestoActivityEntry[];
  /** Desktop only (ZIG-I29-1): meta line, Cliente counts and the Aceptado / Cancelado cards. */
  authorName?: string | null;
  canceledAt?: string | null;
  clientTicketCount?: number | null;
  clientPresupuestoCount?: number | null;
  convertedTicket?: PresupuestoConvertedTicket | null;
};

/**
 * Presupuesto detail (/presupuestos/[id]); since ZIG-I24-4 also where Guardar
 * presupuesto lands (the listo review is gone). One primary CTA: Compartir presupuesto (share sheet with
 * the PDF, WhatsApp text with Válido hasta as the fallback). No Pago, Finalizar,
 * Recordatorios. From 1024px the detail adds Estado, Cliente and Actividad.
 */
export const PresupuestoView = ({
  presupuestoId,
  folio = null,
  clientId,
  clientName,
  clientTel,
  clientPhone = null,
  clientEmail = null,
  clientAddress = null,
  ticketDate,
  expiresAt,
  createdAt = null,
  updatedAt = null,
  workNotes,
  total,
  lines,
  status,
  convertedToTicketId,
  downloadFileName,
  editHref = null,
  activity = [],
  authorName = null,
  canceledAt = null,
  clientTicketCount = null,
  clientPresupuestoCount = null,
  convertedTicket = null,
}: PresupuestoViewProps) => {
  const router = useRouter();
  const docLabel = folio || `#${presupuestoId}`;
  const { can } = usePermissions();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const canInvoice = canDownloadTicketInvoice(can);
  const canWrite = canWriteTickets(can);

  const [phase, setPhase] = React.useState<'idle' | 'sharing' | 'downloading'>('idle');
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [confirm, setConfirm] = React.useState<'convert' | 'cancel' | null>(null);
  const [mutating, setMutating] = React.useState(false);
  const { duplicating, duplicate } = usePresupuestoDuplicate(companyId);
  const [extendOpen, setExtendOpen] = React.useState(false);

  const isMutable = status === 'abierto' || status === 'vencido';
  const servicesSummary = lines
    .slice(0, 3)
    .map((line) => line.name)
    .join(', ');

  const loadPdf = async (): Promise<File> => {
    if (pdfFile) return pdfFile;
    const file = await fetchTicketInvoiceFile({
      ticketId: presupuestoId,
      downloadFileName,
      companyId,
    });
    setPdfFile(file);
    return file;
  };

  const openWhatsAppFallback = (): boolean => {
    const share = buildWhatsAppQuoteShare({
      phone: clientTel,
      clientName,
      ticketId: presupuestoId,
      folio,
      total,
      servicesSummary,
      validUntil: expiresAt,
      companyName: selectedCompany?.name,
    });
    if (!share) return false;
    window.open(share.href, '_blank', 'noopener,noreferrer');
    return true;
  };

  const handleShare = async () => {
    if (phase !== 'idle') return;
    setPhase('sharing');
    try {
      let result: Awaited<ReturnType<typeof shareTicketInvoiceFile>> = 'unsupported';
      let file: File | null = null;
      if (canInvoice) {
        file = await loadPdf();
        result = await shareTicketInvoiceFile(file, {
          title: `Presupuesto ${docLabel}`,
          text: clientName ? `Presupuesto para ${clientName}` : undefined,
        });
      }
      if (result === 'shared') {
        toast.success('Presupuesto compartido');
      } else if (result === 'needs-gesture') {
        toast.message('Presupuesto listo', {
          description: 'Toca Compartir presupuesto para enviarlo.',
        });
      } else if (result === 'unsupported') {
        if (openWhatsAppFallback()) {
          toast.success('Abrimos WhatsApp con el resumen del presupuesto');
        } else if (file) {
          downloadTicketInvoiceFile(file);
          toast.success('PDF descargado');
        } else {
          toast.error('Agrega un teléfono al cliente para compartirlo');
        }
      }
    } catch {
      toast.error('No se pudo preparar el presupuesto');
    } finally {
      setPhase('idle');
    }
  };

  const handleDownload = async () => {
    if (phase !== 'idle') return;
    setPhase('downloading');
    try {
      downloadTicketInvoiceFile(await loadPdf());
    } catch {
      toast.error('No se pudo descargar el PDF');
    } finally {
      setPhase('idle');
    }
  };

  const handleConvert = async () => {
    setMutating(true);
    try {
      const result = await convertPresupuestoToTicket(Number(presupuestoId), companyId);
      if (!result.success || !result.data) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo convertir el presupuesto'));
        return;
      }
      toast.success(`Presupuesto aceptado: ticket ${result.data.ticketFolio ?? `#${result.data.ticketId}`}`);
      router.push(`/tickets/${result.data.ticketId}`);
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  };

  const handleCancel = async () => {
    setMutating(true);
    try {
      const result = await cancelPresupuesto(Number(presupuestoId), companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo cancelar el presupuesto'));
        return;
      }
      toast.success('Presupuesto cancelado');
      router.refresh();
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  };

  const confirmSheet = (
    <PresupuestoConfirmSheet
      kind={confirm}
      docLabel={docLabel}
      pending={mutating}
      onClose={() => setConfirm(null)}
      onConfirm={(kind) => void (kind === 'convert' ? handleConvert() : handleCancel())}
    />
  );

  return (
    <>
      <PresupuestoDetailLayout
        presupuestoId={presupuestoId}
        folio={folio}
        clientId={clientId}
        clientName={clientName}
        clientTel={clientTel}
        clientPhone={clientPhone}
        clientEmail={clientEmail}
        clientAddress={clientAddress}
        companyName={selectedCompany?.name ?? null}
        ticketDate={ticketDate}
        expiresAt={expiresAt}
        createdAt={createdAt}
        updatedAt={updatedAt}
        workNotes={workNotes}
        total={total}
        lines={lines}
        status={status}
        convertedToTicketId={convertedToTicketId}
        editHref={editHref}
        canWrite={canWrite}
        canInvoice={canInvoice}
        isMutable={isMutable}
        mutating={mutating}
        sharing={phase === 'sharing'}
        downloading={phase === 'downloading'}
        duplicating={duplicating}
        onShare={() => void handleShare()}
        onDownload={() => void handleDownload()}
        onConvert={() => setConfirm('convert')}
        onCancel={() => setConfirm('cancel')}
        onDuplicate={() => void duplicate(presupuestoId)}
        onExtend={canWrite && isMutable ? () => setExtendOpen(true) : undefined}
        activity={activity}
        authorName={authorName}
        canceledAt={canceledAt}
        clientTicketCount={clientTicketCount}
        clientPresupuestoCount={clientPresupuestoCount}
        convertedTicket={convertedTicket}
      />
      {confirmSheet}
      {canWrite && isMutable ? (
        <PresupuestoExtendDialog
          open={extendOpen}
          onOpenChange={setExtendOpen}
          presupuestoId={presupuestoId}
          folio={folio}
          ticketDate={ticketDate}
          expiresAt={expiresAt}
          companyId={companyId}
          onExtended={() => router.refresh()}
        />
      ) : null}
    </>
  );
};
