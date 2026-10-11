'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Ban,
  CalendarClock,
  Copy,
  Download,
  FileText,
  Loader2,
  Pencil,
  Share2,
  Ticket,
} from 'lucide-react';

import {
  DocumentSummaryRows,
  type DocumentSummaryLine,
} from '@/components/documents/document-summary-rows';
import { MoneyFigure } from '@/components/documents/money-figure';
import { BlurFade } from '@/components/motion';
import { REVIEW_SECTION_CLASS, type ReviewLine } from '@/components/tickets/review/document-review-parts';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { collapseBlankLines } from '@/lib/collapse-blank-lines';
import { formatLongDate } from '@/lib/format-long-date';
import { materialDraftAmount } from '@/lib/material-drafts';
import { describePresupuestoVigencia } from '@/lib/presupuesto-vigencia';
import { reviewLineAmount } from '@/lib/review-lines';
import { PRESUPUESTO_STATUS_LABEL, type PresupuestoStatus } from '@/lib/ticket-document-kind';
import { cn } from '@/lib/utils';

const STATUS_PILL_CLASS: Record<PresupuestoStatus, string> = {
  abierto: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  vencido: 'bg-red-500/15 text-red-700 dark:text-red-300',
  convertido: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  cancelado: 'bg-slate-500/10 text-muted-foreground',
};

export const PresupuestoStatusPill = ({
  status,
  className,
}: {
  status: PresupuestoStatus;
  className?: string;
}) => (
  <span
    data-testid="presupuesto-status"
    className={cn(
      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
      STATUS_PILL_CLASS[status],
      className,
    )}
  >
    {PRESUPUESTO_STATUS_LABEL[status]}
  </span>
);

const countLabel = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const conceptsToggleLabel = (concepts: number, materials: number) =>
  materials === 0
    ? `Ver los ${countLabel(concepts, 'concepto', 'conceptos')}`
    : `Ver los ${countLabel(concepts, 'concepto', 'conceptos')} y ${countLabel(materials, 'material', 'materiales')}`;

/** Notes longer than this fold behind Ver todas. */
const CONDITIONS_FOLD_CHARS = 160;

const PresupuestoConditions = ({ notes }: { notes: string }) => {
  const [expanded, setExpanded] = React.useState(false);
  const text = collapseBlankLines(notes);
  const foldable = text.length > CONDITIONS_FOLD_CHARS || text.split('\n').length > 3;
  return (
    <section aria-labelledby="presupuesto-conditions-heading" data-testid="presupuesto-conditions">
      <h2 id="presupuesto-conditions-heading" className="mb-1.5 text-[15px] font-semibold">
        Condiciones
      </h2>
      <p
        className={cn(
          'whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]',
          foldable && !expanded && 'line-clamp-3',
        )}
        data-testid="presupuesto-notes"
      >
        {text}
      </p>
      {foldable ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 min-h-11 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver todas'}
        </button>
      ) : null}
    </section>
  );
};

export type PresupuestoDetailLayoutProps = {
  presupuestoId: string;
  clientId: number | null;
  clientName: string | null;
  ticketDate: string | null;
  expiresAt: string | null;
  workNotes: string | null;
  total: number;
  lines: ReviewLine[];
  status: PresupuestoStatus;
  convertedToTicketId: string | null;
  editHref: string | null;
  canWrite: boolean;
  canInvoice: boolean;
  /** Abierto or Vencido: can still be edited, converted or cancelled. */
  isMutable: boolean;
  mutating: boolean;
  sharing: boolean;
  downloading: boolean;
  duplicating: boolean;
  onShare: () => void;
  onDownload: () => void;
  onConvert: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
};

/**
 * Presupuesto detail as drawn in the canvas (ZIG-I13-5): the total with its
 * validity, "¿Lo aceptó el cliente?" with Convertir a ticket near the top,
 * Condiciones, a Conceptos summary and an Editar / Duplicar / Cancelar row.
 * Sharing is the icon in the app bar.
 */
export const PresupuestoDetailLayout = ({
  presupuestoId,
  clientId,
  clientName,
  ticketDate,
  expiresAt,
  workNotes,
  total,
  lines,
  status,
  convertedToTicketId,
  editHref,
  canWrite,
  canInvoice,
  isMutable,
  mutating,
  sharing,
  downloading,
  duplicating,
  onShare,
  onDownload,
  onConvert,
  onCancel,
  onDuplicate,
}: PresupuestoDetailLayoutProps) => {
  const issued = formatLongDate(ticketDate);
  const vigencia = describePresupuestoVigencia({ expiresAt, status });
  const materialsCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const counts = [
    countLabel(lines.length, 'concepto', 'conceptos'),
    materialsCount > 0 ? countLabel(materialsCount, 'material', 'materiales') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = React.useMemo<DocumentSummaryLine[]>(
    () =>
      lines.map((line) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
        amount: reviewLineAmount(line),
        materials: (line.materials ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          amount: materialDraftAmount(item),
        })),
      })),
    [lines],
  );

  const canShare = status !== 'cancelado';
  const showEdit = canWrite && isMutable && Boolean(editHref);
  const showCancel = canWrite && isMutable;

  const shareButton = canShare ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11 shrink-0"
      aria-label="Compartir presupuesto"
      disabled={sharing}
      onClick={onShare}
    >
      {sharing ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        <Share2 className="h-5 w-5" aria-hidden />
      )}
    </Button>
  ) : null;

  const actionButtons = canWrite ? (
    <>
      {showEdit ? (
        <Button asChild variant="outline" className="h-11 gap-2 rounded-[10px]">
          <Link href={editHref as string}>
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Link>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2 rounded-[10px]"
        disabled={duplicating}
        onClick={onDuplicate}
      >
        {duplicating ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        Duplicar
      </Button>
      {showCancel ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 rounded-[10px] text-destructive hover:text-destructive"
          disabled={mutating}
          onClick={onCancel}
          aria-label="Cancelar presupuesto"
        >
          <Ban className="h-4 w-4" aria-hidden />
          Cancelar
        </Button>
      ) : null}
    </>
  ) : null;
  const actionCount = Number(showEdit) + Number(canWrite) + Number(showCancel);

  return (
    <>
      <TripledDashboardShell maxWidthClassName="max-w-2xl" contentClassName="space-y-3 md:space-y-4">
        <TripledMobileAppBar
          title={`Presupuesto #${presupuestoId}`}
          backHref="/presupuestos"
          backLabel="Volver a presupuestos"
          endSlot={
            <div className="flex shrink-0 items-center">
              <PresupuestoStatusPill status={status} />
              {shareButton}
            </div>
          }
        />

        <BlurFade>
          <header className="min-w-0 space-y-1" data-testid="presupuesto-header">
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
                Presupuesto #{presupuestoId}
              </p>
              <PresupuestoStatusPill status={status} />
              {shareButton}
            </div>
            <h1 className="text-[19px] font-bold leading-snug tracking-tight [overflow-wrap:anywhere] md:text-3xl md:font-semibold">
              {clientId ? (
                <Link href={`/clients/${clientId}`} className="outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring">
                  {clientName ?? 'Cliente'}
                </Link>
              ) : (
                (clientName ?? 'Cliente')
              )}
            </h1>
            {issued ? <p className="text-[13px] text-muted-foreground md:text-sm">Emitido el {issued}</p> : null}
          </header>
        </BlurFade>

        <BlurFade delay={0.04}>
          <section aria-label="Total y vigencia" className={cn(REVIEW_SECTION_CLASS, 'space-y-2')}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">Total del presupuesto</span>
              <span className="text-right text-xs text-muted-foreground" data-testid="presupuesto-counts">
                {counts}
              </span>
            </div>
            <MoneyFigure
              amount={total}
              size="hero"
              className="block font-bold leading-tight"
              data-testid="review-total"
            />
            <p
              className={cn(
                'flex items-center gap-2 text-[13px]',
                vigencia.tone === 'expired'
                  ? 'text-red-700 dark:text-red-300'
                  : vigencia.tone === 'soon'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-muted-foreground',
              )}
              data-testid="presupuesto-expires"
            >
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              {vigencia.text}
            </p>
          </section>
        </BlurFade>

        {canWrite && isMutable ? (
          <BlurFade delay={0.08}>
            <section
              aria-labelledby="presupuesto-accept-heading"
              className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5"
              data-testid="presupuesto-accept"
            >
              <h2 id="presupuesto-accept-heading" className="text-[15px] font-semibold">
                ¿Lo aceptó el cliente?
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Conviértelo en ticket para trabajarlo y cobrar el anticipo.
              </p>
              <Button
                type="button"
                className="h-12 w-full rounded-xl text-[15px] font-semibold"
                disabled={mutating}
                onClick={onConvert}
              >
                Convertir a ticket
              </Button>
            </section>
          </BlurFade>
        ) : null}

        {status === 'convertido' && convertedToTicketId ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />
              Convertido en Ticket #{convertedToTicketId}
            </span>
            <Link
              href={`/tickets/${convertedToTicketId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver ticket
            </Link>
          </div>
        ) : null}
        {status === 'cancelado' ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
          >
            <Ban className="h-4 w-4" aria-hidden />
            Presupuesto cancelado. Sólo lectura.
          </div>
        ) : null}

        {workNotes?.trim() ? (
          <BlurFade delay={0.1}>
            <PresupuestoConditions notes={workNotes} />
          </BlurFade>
        ) : null}

        <BlurFade delay={0.12}>
          <section aria-labelledby="presupuesto-concepts-heading">
            <h2 id="presupuesto-concepts-heading" className="mb-2 text-[15px] font-semibold">
              Conceptos
            </h2>
            <DocumentSummaryRows
              lines={rows}
              label="Servicios del presupuesto"
              toggleLabel={conceptsToggleLabel}
            />
          </section>
        </BlurFade>

        {canInvoice ? (
          <div className="flex flex-wrap items-center justify-center gap-x-6" data-testid="presupuesto-pdf-links">
            <Link
              href={`/presupuestos/${presupuestoId}/pdf`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Abrir PDF
            </Link>
            <button
              type="button"
              disabled={downloading}
              onClick={onDownload}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              Descargar PDF
            </button>
          </div>
        ) : null}

        {actionButtons ? (
          <div
            className={cn('hidden gap-2 md:grid', actionCount === 3 ? 'grid-cols-3' : 'grid-cols-2')}
            data-testid="presupuesto-actions-desktop"
          >
            {actionButtons}
          </div>
        ) : null}
      </TripledDashboardShell>

      {actionButtons ? (
        <TripledMobileStickyActionBar>
          <div
            className={cn('grid w-full gap-2', actionCount === 3 ? 'grid-cols-3' : 'grid-cols-2')}
            data-testid="presupuesto-actions"
          >
            {actionButtons}
          </div>
        </TripledMobileStickyActionBar>
      ) : null}
    </>
  );
};
