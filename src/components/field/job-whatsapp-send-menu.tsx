'use client';

import * as React from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getFieldSendOptions,
  type FieldJobSnapshot,
  type FieldSendOptionId,
} from '@/lib/field-job-snapshot';
import { classifyClientError } from '@/lib/network-awareness';
import { deliverOfflineReceipt } from '@/lib/offline-receipt';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import {
  buildWhatsAppBalanceShare,
  buildWhatsAppDayVisitShare,
  buildWhatsAppOfflineReceiptShare,
  buildWhatsAppQuoteShare,
} from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

export type JobWhatsAppSendMenuProps = {
  job: FieldJobSnapshot;
  triggerLabel?: string;
  triggerClassName?: string;
  /** Prefer highlighting one option (Anotar success). */
  highlightId?: FieldSendOptionId | null;
  /** Controlled open for tests / success panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

const buildPdfFileName = (job: FieldJobSnapshot): string => {
  const safeName =
    (job.clientName ?? 'ticket').replace(/[^\w\s\-]/g, '').trim() || 'ticket';
  const datePart = job.ticketDate
    ? job.ticketDate.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const id = job.ticketId ?? 'local';
  return `${safeName}_${datePart}_${id}.pdf`;
};

const openHref = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer');
};

export const JobWhatsAppSendMenu = ({
  job,
  triggerLabel = 'Enviar',
  triggerClassName,
  highlightId,
  open: controlledOpen,
  onOpenChange,
  variant = 'outline',
  size = 'sm',
}: JobWhatsAppSendMenuProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [busyId, setBusyId] = React.useState<FieldSendOptionId | null>(null);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const options = getFieldSendOptions(job, {
    online: isOnline,
    highlightId,
  });

  const handleOption = async (id: FieldSendOptionId) => {
    if (busyId) return;

    if (id === 'voy_en_camino') {
      const share = buildWhatsAppDayVisitShare({
        phone: job.clientTel,
        clientName: job.clientName,
        ticketId: job.ticketId ?? job.localJobId ?? 'pendiente',
        companyName: job.companyName,
      });
      if (!share) {
        toast.error('Agrega un teléfono al cliente');
        return;
      }
      openHref(share.href);
      setOpen(false);
      return;
    }

    if (id === 'recordar_saldo') {
      const share = buildWhatsAppBalanceShare({
        phone: job.clientTel,
        clientName: job.clientName,
        ticketId: job.ticketId ?? job.localJobId ?? 'pendiente',
        balanceDue: job.balanceDue,
        companyName: job.companyName,
      });
      if (!share) {
        toast.error('Agrega un teléfono al cliente');
        return;
      }
      openHref(share.href);
      setOpen(false);
      return;
    }

    if (id === 'enviar_presupuesto') {
      const share = buildWhatsAppQuoteShare({
        phone: job.clientTel,
        clientName: job.clientName,
        ticketId: job.ticketId ?? job.localJobId ?? 'pendiente',
        total: job.total,
        servicesSummary: job.servicesSummary ?? job.workNotesSummary,
        validUntil: job.validUntil,
        companyName: job.companyName,
      });
      if (!share) {
        toast.error('Agrega un teléfono al cliente');
        return;
      }
      openHref(share.href);
      setOpen(false);
      return;
    }

    if (id === 'enviar_recibo') {
      const receiptInput = {
        clientName: job.clientName,
        ticketId: job.ticketId,
        localJobId: job.localJobId,
        workNotesSummary: job.workNotesSummary ?? job.servicesSummary,
        total: job.total,
        paid: job.paid,
        balanceDue: job.balanceDue,
        ticketDate: job.ticketDate,
        companyName: job.companyName,
      };
      const offlineShare = buildWhatsAppOfflineReceiptShare(
        job.clientTel,
        receiptInput,
      );

      const ticketId = job.ticketId;
      const useOffline =
        !isOnline || !ticketId || job.pendingSync === true;

      if (useOffline || !ticketId) {
        setBusyId(id);
        try {
          const result = await deliverOfflineReceipt({
            input: receiptInput,
            whatsappHref: offlineShare?.href,
          });
          if (result === 'shared') {
            toast.success('Recibo simple compartido');
          } else if (result === 'whatsapp') {
            toast.success('Recibo simple listo en WhatsApp');
          } else if (result === 'copied') {
            toast.success('Recibo simple copiado');
          }
          setOpen(false);
        } catch {
          toast.error(
            'No se pudo enviar el recibo simple. Revisa el teléfono del cliente.',
          );
        } finally {
          setBusyId(null);
        }
        return;
      }

      setBusyId(id);
      try {
        const result = await fetchAndDeliverTicketInvoice({
          ticketId,
          companyId: job.companyId,
          downloadFileName: buildPdfFileName(job),
        });
        if (result === 'shared') {
          toast.success('PDF compartido correctamente');
        } else if (result === 'downloaded') {
          toast.success('PDF descargado correctamente');
        }
        setOpen(false);
      } catch (error) {
        const errorType = classifyClientError(error);
        if (errorType === 'network' || !navigator.onLine) {
          toast.message('Sin internet — enviando recibo simple', {
            description:
              'El PDF oficial se envía cuando haya señal.',
          });
          try {
            await deliverOfflineReceipt({
              input: receiptInput,
              whatsappHref: offlineShare?.href,
            });
            setOpen(false);
          } catch {
            toast.error('No se pudo generar el recibo. Intenta de nuevo.');
          }
        } else {
          toast.error('No se pudo generar el PDF. Intenta de nuevo.');
        }
      } finally {
        setBusyId(null);
      }
    }
  };

  if (options.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn('min-h-11 rounded-lg sm:min-h-9', triggerClassName)}
        onClick={() => setOpen(true)}
        aria-label={`Enviar por WhatsApp job ${job.ticketId ?? job.localJobId ?? ''}`}
        data-testid="field-send-menu-trigger"
      >
        <MessageCircle className="h-4 w-4" aria-hidden data-icon="inline-start" />
        {triggerLabel}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          data-testid="field-send-menu-sheet"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Enviar</SheetTitle>
            <SheetDescription>
              {job.clientName?.trim() || 'Cliente'}
              {job.ticketId ? ` · #${job.ticketId}` : ' · pendiente de subir'}
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-4 space-y-2" aria-label="Opciones de envío">
            {options.map((option) => (
              <li key={option.id}>
                <Button
                  type="button"
                  variant={option.highlight ? 'default' : 'outline'}
                  className="h-auto min-h-12 w-full justify-start rounded-xl px-4 py-3 text-left"
                  disabled={!option.enabled || busyId !== null}
                  onClick={() => void handleOption(option.id)}
                  aria-label={option.label}
                  data-testid={`field-send-option-${option.id}`}
                >
                  {busyId === option.id ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden
                      data-icon="inline-start"
                    />
                  ) : (
                    <MessageCircle
                      className="h-4 w-4"
                      aria-hidden
                      data-icon="inline-start"
                    />
                  )}
                  <span className="flex flex-col items-start gap-0.5">
                    <span>{option.label}</span>
                    {!option.enabled && option.disabledReason ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {option.disabledReason}
                      </span>
                    ) : null}
                    {busyId === option.id && option.id === 'enviar_recibo' ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        Generando recibo…
                      </span>
                    ) : null}
                  </span>
                </Button>
              </li>
            ))}
          </ul>

          {!isOnline ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Sin internet — recibo simple. El PDF oficial se envía cuando haya
              señal.
            </p>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
};
