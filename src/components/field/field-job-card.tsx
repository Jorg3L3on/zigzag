'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { JobWhatsAppSendMenu } from '@/components/field/job-whatsapp-send-menu';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import type { FieldJobSnapshot } from '@/lib/field-job-snapshot';
import { buildTelHref } from '@/lib/phone-links';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';
import { isPresupuestoTicket } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

export type FieldJobCardProps = {
  job: FieldJobSnapshot;
  canWrite?: boolean;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  className?: string;
  /** Use li wrapper when rendering inside a list. */
  asListItem?: boolean;
};

export const FieldJobCard = ({
  job,
  canWrite = false,
  onPaymentApplied,
  className,
  asListItem = true,
}: FieldJobCardProps) => {
  const [collectOpen, setCollectOpen] = React.useState(false);
  const telHref = buildTelHref(job.clientTel);
  const displayId = job.ticketId ?? job.localJobId ?? 'local';
  const isQuote = isPresupuestoTicket(job.documentKind);
  const showCollect =
    canWrite &&
    !isQuote &&
    job.finished &&
    job.balanceDue > 0 &&
    Boolean(job.ticketId);
  const openHref = job.ticketId
    ? job.finished
      ? `/tickets/${job.ticketId}`
      : `/tickets/${job.ticketId}/edit`
    : null;

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold sm:text-base">
              {job.clientName?.trim() || 'Cliente sin nombre'}
            </p>
            {job.pendingSync ? (
              <Badge variant="outline" className="shadow-none">
                Pendiente de subir
              </Badge>
            ) : null}
            {job.isOverdue ? (
              <Badge variant="destructive" className="shadow-none">
                Atrasado
              </Badge>
            ) : !job.finished && !isQuote ? (
              <Badge variant="secondary" className="shadow-none">
                Hoy
              </Badge>
            ) : null}
            {isQuote ? (
              <Badge variant="secondary" className="shadow-none">
                Presupuesto
              </Badge>
            ) : (
              <TicketPaymentBadge total={job.total} paid={job.paid} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">#{displayId}</span>
            {job.ticketDate ? (
              <>
                {' · '}
                <FormattedDate date={new Date(job.ticketDate)} />
              </>
            ) : null}
            {job.balanceDue > 0 ? (
              <>
                {' · '}
                Saldo {formatTicketListAmount(job.balanceDue)}
              </>
            ) : null}
          </p>
          {job.servicesSummary || job.workNotesSummary ? (
            <p className="truncate text-xs text-muted-foreground">
              {job.servicesSummary || job.workNotesSummary}
            </p>
          ) : null}
          {job.clientTel ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {job.clientTel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {openHref ? (
          <Button
            variant="default"
            size="sm"
            className="min-h-11 rounded-lg sm:min-h-9"
            asChild
          >
            <Link
              href={openHref}
              aria-label={
                job.finished
                  ? `Ver ticket ${displayId}`
                  : `Abrir y editar ticket ${displayId}`
              }
            >
              {job.finished ? 'Ver' : 'Abrir'}
            </Link>
          </Button>
        ) : null}

        {showCollect ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 rounded-lg sm:min-h-9"
            onClick={() => setCollectOpen(true)}
            aria-label={`Cobrar ticket ${displayId}`}
          >
            <Banknote className="h-4 w-4" aria-hidden data-icon="inline-start" />
            Cobrar
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="min-h-11 rounded-lg sm:min-h-9"
          disabled={!telHref}
          asChild={Boolean(telHref)}
          aria-label={
            telHref
              ? `Llamar a ${job.clientName ?? job.clientTel}`
              : `Sin teléfono para ${displayId}`
          }
        >
          {telHref ? (
            <a href={telHref}>
              <Phone className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Llamar
            </a>
          ) : (
            <span>
              <Phone className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Llamar
            </span>
          )}
        </Button>

        <JobWhatsAppSendMenu job={job} />
      </div>

      {showCollect && job.ticketId ? (
        <TicketListCollectPaymentDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          ticketId={Number(job.ticketId)}
          total={job.total}
          paid={job.paid}
          companyId={job.companyId}
          onPaymentApplied={(result) => {
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </>
  );

  const classes = cn(
    'rounded-xl border border-border/60 bg-background/80 p-3 sm:p-4',
    className,
  );

  if (asListItem) {
    return <li className={classes}>{body}</li>;
  }

  return <div className={classes}>{body}</div>;
};
