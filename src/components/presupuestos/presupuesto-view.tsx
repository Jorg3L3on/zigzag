'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
  duplicatePresupuesto,
} from '@/actions/presupuestos';
import { ConfirmSheet } from '@/components/documents/confirm-sheet';
import { PresupuestoDetailLayout } from '@/components/presupuestos/presupuesto-detail-layout';
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
import {
  buildPresupuestoComposerDraftKey,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';
import { buildWhatsAppQuoteShare } from '@/lib/whatsapp-share';

export type PresupuestoViewProps = {
  presupuestoId: string;
  /** Company folio (P-0003); falls back to `#id`. */
  folio?: string | null;
  clientId: number | null;
  clientName: string | null;
  clientTel: string | null;
  ticketDate: string | null;
  expiresAt: string | null;
  workNotes: string | null;
  total: number;
  lines: ReviewLine[];
  status: PresupuestoStatus;
  convertedToTicketId: string | null;
  downloadFileName: string;
  /** Editar shows only when the edit route exists (ZIG-I5-5). */
  editHref?: string | null;
};

/**
 * Presupuesto detail (/presupuestos/[id]); since ZIG-I24-4 also where Guardar
 * presupuesto lands (the listo review is gone). One primary CTA: Compartir presupuesto (share sheet with
 * the PDF, WhatsApp text with Válido hasta as the fallback). No Pago, Finalizar,
 * Recordatorios or Actividad: a quote is not a work ticket.
 */
export const PresupuestoView = ({
  presupuestoId,
  folio = null,
  clientId,
  clientName,
  clientTel,
  ticketDate,
  expiresAt,
  workNotes,
  total,
  lines,
  status,
  convertedToTicketId,
  downloadFileName,
  editHref = null,
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
  const [duplicating, setDuplicating] = React.useState(false);

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

  /** Duplicar: a draft in the presupuesto composer, saved only on Guardar (ZIG-I13-5). */
  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const result = await duplicatePresupuesto(Number(presupuestoId), companyId);
      if (!result.success) {
        toast.error(getErrorDisplayMessage(result, 'No se pudo duplicar el presupuesto'));
        return;
      }
      const draft = result.data;
      if (companyId) {
        writeTicketComposerDraft(buildPresupuestoComposerDraftKey(companyId), {
          client_id: draft.client.id > 0 ? draft.client.id : undefined,
          client_label: draft.client.label,
          ticket_date: draft.ticketDate,
          ...(draft.expiresAt ? { expires_at: draft.expiresAt } : {}),
          work_notes: draft.notes,
          lines: draft.lines,
        });
      }
      toast.success('Borrador listo: revísalo y guarda');
      router.push('/presupuestos/create');
    } catch {
      toast.error('No se pudo duplicar el presupuesto');
    } finally {
      setDuplicating(false);
    }
  };

  const confirmSheet = (
    <ConfirmSheet
      open={confirm !== null}
      onOpenChange={(open) => {
        if (!open && !mutating) setConfirm(null);
      }}
      title={
        confirm === 'convert'
          ? `¿Convertir el presupuesto ${docLabel} en ticket?`
          : `¿Cancelar el presupuesto ${docLabel}?`
      }
      description={
        confirm === 'convert'
          ? 'Se crea un ticket de trabajo con los mismos servicios y precios. El presupuesto queda como Aceptado.'
          : 'Sale de los presupuestos abiertos y queda sólo para consulta. No se puede deshacer.'
      }
      confirmLabel={confirm === 'convert' ? 'Convertir a ticket' : 'Cancelar presupuesto'}
      cancelLabel="Volver"
      destructive={confirm === 'cancel'}
      pending={mutating}
      onConfirm={() => (confirm === 'convert' ? handleConvert() : handleCancel())}
    />
  );

  return (
    <>
      <PresupuestoDetailLayout
        presupuestoId={presupuestoId}
        folio={folio}
        clientId={clientId}
        clientName={clientName}
        ticketDate={ticketDate}
        expiresAt={expiresAt}
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
        onDuplicate={() => void handleDuplicate()}
      />
      {confirmSheet}
    </>
  );
};
