'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  History,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Receipt,
  Ticket,
} from 'lucide-react';

import type { PresupuestoConvertedTicket } from '@/actions/presupuestos';
import { DocumentLineRow } from '@/components/documents/document-line-row';
import { DocumentLinesDensitySwitch } from '@/components/documents/document-lines-density-switch';
import { MoneyFigure } from '@/components/documents/money-figure';
import { PresupuestoStatusPill } from '@/components/presupuestos/presupuesto-status-pill';
import type { ReviewLine } from '@/components/tickets/review/document-review-parts';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TicketDetailStatusPill } from '@/components/tickets/detail/ticket-detail-status-pill';
import { TripledDashboardShell } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { collapseBlankLines } from '@/lib/collapse-blank-lines';
import { formatPhoneDisplay } from '@/lib/phone-links';
import { formatRelativeActivityTime } from '@/lib/format-relative-time';
import { materialDraftAmount } from '@/lib/material-drafts';
import { sumLineTotals, sumMaterialTotals } from '@/lib/money';
import {
  describePresupuestoPastVigencia,
  describePresupuestoVigenciaCard,
  describePresupuestoVigenciaChip,
  longDate,
  type PresupuestoVigencia,
} from '@/lib/presupuesto-vigencia';
import { reviewLineAmount } from '@/lib/review-lines';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import {
  formatPresupuestoActivityCardTitle,
  formatTicketTimelineEntry,
  getTicketTimelineIcon,
  type TicketTimelineIconKey,
} from '@/lib/ticket-audit-display';
import { cn } from '@/lib/utils';
import { buildWhatsAppQuoteReminder, buildWhatsAppQuoteShare } from '@/lib/whatsapp-share';

const RECEIPT_COLUMNS = 'grid-cols-[minmax(0,1fr)_72px_120px_130px]';

const ACTIVITY_PREVIEW = 4;

const TIMELINE_ICONS: Record<
  TicketTimelineIconKey,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  ticket: Ticket,
  payment: Receipt,
  generic: Activity,
};

export type PresupuestoActivityEntry = {
  id: number;
  eventType: string;
  createdAt: Date | string;
  actorName: string | null;
  payload: Record<string, unknown> | null;
};

export type PresupuestoDesktopProps = {
  presupuestoId: string;
  folio?: string | null;
  clientId: number | null;
  clientName: string | null;
  clientTel?: string | null;
  /** Client record phone. The card falls back to `clientTel`. */
  clientPhone?: string | null;
  clientEmail?: string | null;
  /** One line, or null when the client has no address. */
  clientAddress?: string | null;
  companyName?: string | null;
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
  isMutable: boolean;
  mutating: boolean;
  sharing: boolean;
  downloading: boolean;
  duplicating: boolean;
  activity?: PresupuestoActivityEntry[];
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  /** Who wrote it, for the meta line under the client. */
  authorName?: string | null;
  canceledAt?: string | null;
  clientTicketCount?: number | null;
  clientPresupuestoCount?: number | null;
  /** The R ticket an accepted presupuesto became. */
  convertedTicket?: PresupuestoConvertedTicket | null;
  /** Extender vigencia (ZIG-I29-2); hidden when absent. */
  onExtend?: () => void;
  onShare: () => void;
  onDownload: () => void;
  onConvert: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
};

const countLabel = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clientInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
};

const vigenciaClass = (tone: PresupuestoVigencia['tone']) =>
  tone === 'expired'
    ? 'text-red-700 dark:text-red-300'
    : tone === 'soon'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-muted-foreground';

const VIGENCIA_CHIP_CLASS: Record<PresupuestoVigencia['tone'], string> = {
  expired: 'bg-red-500/15 text-red-700 dark:text-red-300',
  soon: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  ok: 'bg-muted text-muted-foreground',
  none: 'bg-muted text-muted-foreground',
};

const VIGENCIA_BAR_CLASS: Record<PresupuestoVigencia['tone'], string> = {
  expired: 'bg-red-500',
  soon: 'bg-amber-500',
  ok: 'bg-primary',
  none: 'bg-muted-foreground/40',
};

const servicesSummaryOf = (lines: ReviewLine[]) =>
  lines
    .slice(0, 3)
    .map((line) => line.name)
    .join(', ');

/** The newest event of a type, for «Aceptado el …» and «Cancelado el …». */
const latestEvent = (entries: PresupuestoActivityEntry[], eventType: string) =>
  entries.find((entry) => entry.eventType === eventType) ?? null;

type QuoteWhatsAppInput = Pick<
  PresupuestoDesktopProps,
  | 'presupuestoId'
  | 'folio'
  | 'clientName'
  | 'clientTel'
  | 'clientPhone'
  | 'companyName'
  | 'expiresAt'
  | 'total'
  | 'lines'
>;

const quotePhone = ({ clientPhone, clientTel }: Pick<QuoteWhatsAppInput, 'clientPhone' | 'clientTel'>) =>
  clientPhone?.trim() || clientTel?.trim() || '';

const quoteShareInput = (input: QuoteWhatsAppInput) => ({
  phone: quotePhone(input),
  clientName: input.clientName?.trim() || 'Cliente',
  ticketId: input.presupuestoId,
  folio: input.folio ?? null,
  total: input.total,
  servicesSummary: servicesSummaryOf(input.lines),
  validUntil: input.expiresAt,
  companyName: input.companyName ?? null,
});

const handleOpenActivity = () => {
  const heading = document.getElementById('presupuesto-timeline-heading');
  const toggle = heading?.querySelector('button');
  if (toggle instanceof HTMLButtonElement && toggle.getAttribute('aria-expanded') === 'false') {
    toggle.click();
  }
  document.getElementById('presupuesto-timeline')?.scrollIntoView?.({ block: 'start' });
};

type HeaderProps = Omit<PresupuestoDesktopProps, 'activity' | 'createdAt' | 'updatedAt'>;

const WhatsAppButton = ({ href, label = 'WhatsApp' }: { href: string | null; label?: string }) =>
  href ? (
    <Button asChild variant="outline" className="h-10 gap-2 rounded-xl">
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid="presupuesto-header-whatsapp">
        <MessageCircle className="h-4 w-4" aria-hidden />
        {label}
      </a>
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      className="h-10 gap-2 rounded-xl"
      disabled
      title="Agrega un teléfono al cliente para enviarlo por WhatsApp"
      data-testid="presupuesto-header-whatsapp"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );

/**
 * Folio, status pill and validity chip, the client, the meta line and the
 * actions of each state (ZIG-I29-1, PresuEstados): Abierto / Vencido →
 * Convertir, WhatsApp, PDF, Editar, ⋯; Aceptado → Ver ticket R, WhatsApp, PDF,
 * ⋯; Cancelado → Duplicar, PDF, ⋯. Desktop shares by WhatsApp, never the
 * system sheet.
 */
const PresupuestoDesktopHeader = (props: HeaderProps) => {
  const {
    presupuestoId,
    folio = null,
    clientId,
    clientName,
    ticketDate,
    expiresAt,
    lines,
    status,
    editHref,
    canWrite,
    canInvoice,
    isMutable,
    mutating,
    downloading,
    duplicating,
    authorName = null,
    convertedToTicketId,
    convertedTicket = null,
    onDownload,
    onConvert,
    onCancel,
    onDuplicate,
    onExtend,
  } = props;
  const issuedDate = asDate(ticketDate);
  // «10 de octubre de 2026», as the canvas meta line reads.
  const issued = issuedDate ? format(issuedDate, "d 'de' MMMM 'de' yyyy", { locale: es }) : null;
  const label = folio || `#${presupuestoId}`;
  const chip = describePresupuestoVigenciaChip({ expiresAt, status });
  const accepted = status === 'convertido';
  const canceled = status === 'cancelado';
  const showConvert = canWrite && isMutable;
  const showEdit = canWrite && isMutable && Boolean(editHref);
  const showWhatsApp = !canceled;
  const showCancel = canWrite && isMutable;
  const showExtend = canWrite && isMutable && Boolean(onExtend);
  const showDuplicatePrimary = canWrite && canceled;
  const name = clientName?.trim() || 'Cliente';
  const materialCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const meta = [
    issued ? `Emitido el ${issued}` : null,
    authorName?.trim() || null,
    countLabel(lines.length, 'concepto', 'conceptos'),
    materialCount > 0 ? countLabel(materialCount, 'material', 'materiales') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const whatsApp = showWhatsApp ? buildWhatsAppQuoteShare(quoteShareInput(props)) : null;
  const ticketHref = convertedToTicketId ? `/tickets/${convertedToTicketId}` : null;
  const ticketLabel = convertedTicket?.folio ? `Ver ticket ${convertedTicket.folio}` : 'Ver ticket';
  // A canceled one only keeps Abrir PDF in the menu.
  const showMenu = canInvoice || (canWrite && !canceled);

  return (
    <header className="flex min-w-0 flex-col gap-3" data-testid="presupuesto-header">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
          Presupuesto {label}
        </p>
        <PresupuestoStatusPill status={status} surface="desktop" />
        {chip ? (
          <span
            data-testid="presupuesto-vigencia-chip"
            data-tone={chip.tone}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold',
              VIGENCIA_CHIP_CLASS[chip.tone],
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {chip.text}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1">
        <h1 className="text-3xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
          {clientId ? (
            <Link
              href={`/clients/${clientId}`}
              className="outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </h1>
        {meta ? (
          <p className="text-sm text-muted-foreground" data-testid="presupuesto-meta">
            {meta}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="presupuesto-desktop-actions">
        {showConvert ? (
          <Button
            type="button"
            className="h-10 gap-2 rounded-xl"
            disabled={mutating}
            onClick={onConvert}
          >
            <Ticket className="h-4 w-4" aria-hidden />
            Convertir a ticket
          </Button>
        ) : null}
        {accepted && ticketHref ? (
          <Button asChild className="h-10 gap-2 rounded-xl">
            <Link href={ticketHref} data-testid="presupuesto-header-ticket">
              <Ticket className="h-4 w-4" aria-hidden />
              {ticketLabel}
            </Link>
          </Button>
        ) : null}
        {showDuplicatePrimary ? (
          <Button
            type="button"
            className="h-10 gap-2 rounded-xl"
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
        ) : null}
        {showWhatsApp ? <WhatsAppButton href={whatsApp?.href ?? null} /> : null}
        {canInvoice ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl"
            aria-label="Descargar PDF"
            disabled={downloading}
            onClick={onDownload}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            PDF
          </Button>
        ) : null}
        {showEdit ? (
          <Button asChild variant="outline" className="h-10 gap-2 rounded-xl">
            <Link href={editHref as string}>
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </Link>
          </Button>
        ) : null}
        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Más acciones del presupuesto"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canInvoice ? (
                <DropdownMenuItem asChild className="min-h-11">
                  <Link href={`/presupuestos/${presupuestoId}/pdf`}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden />
                    Abrir PDF
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {showExtend ? (
                <DropdownMenuItem className="min-h-11" disabled={mutating} onSelect={onExtend}>
                  <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
                  Extender vigencia
                </DropdownMenuItem>
              ) : null}
              {canWrite && !canceled ? (
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={duplicating}
                  onSelect={onDuplicate}
                >
                  <Copy className="mr-2 h-4 w-4" aria-hidden />
                  Duplicar
                </DropdownMenuItem>
              ) : null}
              {showCancel ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="min-h-11 text-destructive focus:text-destructive"
                    disabled={mutating}
                    onSelect={onCancel}
                  >
                    <Ban className="mr-2 h-4 w-4" aria-hidden />
                    Cancelar presupuesto
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
};

const PresupuestoDesktopDocument = ({
  lines,
  total,
  workNotes,
  conditionsEditHref = null,
}: Pick<PresupuestoDesktopProps, 'lines' | 'total' | 'workNotes'> & {
  conditionsEditHref?: string | null;
}) => {
  const materialCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const servicesTotal = sumLineTotals(lines.map((line) => ({ quantity: line.quantity, price: line.price })));
  const materialsTotal = sumMaterialTotals(lines.flatMap((line) => line.materials ?? []));
  const notes = workNotes?.trim() ?? '';

  return (
    <TicketDetailSectionCard aria-labelledby="presupuesto-document-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="presupuesto-document-heading" className="text-[15px] font-semibold">
          Conceptos y materiales
          <span className="font-normal text-muted-foreground">
            {' · '}
            {countLabel(lines.length, 'concepto', 'conceptos')}
            {materialCount > 0 ? ` · ${countLabel(materialCount, 'material', 'materiales')}` : ''}
          </span>
        </h2>
        <DocumentLinesDensitySwitch />
      </div>

      <div
        className={`mb-1 grid items-baseline gap-x-2 text-caption font-medium text-muted-foreground ${RECEIPT_COLUMNS}`}
      >
        <span>Concepto</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">P. unitario</span>
        <span className="text-right">Importe</span>
      </div>

      <ul aria-label="Servicios del presupuesto" className="divide-y divide-border/60">
        {lines.map((line, index) => (
          <li key={line.id}>
            <DocumentLineRow
              layout="receipt"
              index={index + 1}
              name={line.name}
              description={line.description}
              serviceId={line.serviceId}
              quantity={line.quantity}
              price={line.price}
              amount={reviewLineAmount(line)}
              materials={(line.materials ?? []).map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                amount: materialDraftAmount(item),
              }))}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end" data-testid="presupuesto-desktop-totals">
        <dl className="w-full max-w-[360px] space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Servicios</dt>
            <dd>
              <MoneyFigure amount={servicesTotal} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Materiales</dt>
            <dd>
              <MoneyFigure amount={materialsTotal} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="text-[15px] font-semibold">Total del presupuesto</dt>
            <dd>
              <MoneyFigure amount={total} size="lg" />
            </dd>
          </div>
        </dl>
      </div>

      {/* Condiciones as the canvas draws them: a label, the whole text, where it prints. */}
      <section
        aria-labelledby="presupuesto-conditions-heading"
        data-testid="presupuesto-conditions"
        className="mt-7 border-t border-border pt-5"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="presupuesto-conditions-heading" className={RAIL_LABEL_CLASS}>
            Condiciones
          </h2>
          {conditionsEditHref ? (
            <Link
              href={conditionsEditHref}
              className="inline-flex min-h-11 items-center text-caption font-medium text-primary underline-offset-4 hover:underline"
              aria-label={notes ? 'Editar condiciones' : 'Agregar condiciones'}
            >
              {notes ? 'Editar' : 'Agregar'}
            </Link>
          ) : null}
        </div>
        {notes ? (
          <p
            className="mt-1 max-w-[62ch] whitespace-pre-line text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300"
            data-testid="presupuesto-notes"
          >
            {collapseBlankLines(notes)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Sin condiciones</p>
        )}
        <p className="mt-2.5 text-caption text-muted-foreground">
          Se imprimen en el PDF bajo «Condiciones y notas».
        </p>
      </section>
    </TicketDetailSectionCard>
  );
};

const RAIL_LABEL_CLASS = 'text-caption font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * Abierto and Vencido (PresuA): the validity with its tone and bar, then «¿Lo
 * aceptó el cliente?» with Convertir a ticket, Extender vigencia and Recordar
 * por WhatsApp.
 */
const PresupuestoVigenciaCard = (props: HeaderProps) => {
  const {
    status,
    ticketDate,
    expiresAt,
    editHref,
    canWrite,
    mutating,
    onConvert,
    onExtend,
  } = props;
  const vigencia = describePresupuestoVigenciaCard({ ticketDate, expiresAt, status });
  const reminder = buildWhatsAppQuoteReminder(quoteShareInput(props));
  const expired = vigencia.tone === 'expired';

  return (
    <TicketDetailSectionCard
      aria-labelledby="presupuesto-vigencia-heading"
      data-testid="presupuesto-vigencia-card"
      className={cn(expired && 'border-red-500/40')}
    >
      <h2 id="presupuesto-vigencia-heading" className={RAIL_LABEL_CLASS}>
        Vigencia
      </h2>
      <p
        className={cn(
          'mt-2 flex items-start gap-2 text-[17px] font-semibold leading-snug',
          vigencia.tone === 'ok' || vigencia.tone === 'none' ? 'text-foreground' : vigenciaClass(vigencia.tone),
        )}
        data-testid="presupuesto-desktop-expires"
        data-tone={vigencia.tone}
      >
        <CalendarClock className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        <span>{vigencia.text}</span>
      </p>
      {vigencia.progress != null ? (
        <div
          role="img"
          aria-label={`${Math.round(vigencia.progress * 100)}% de la vigencia transcurrida`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          data-testid="presupuesto-vigencia-bar"
        >
          <div
            className={cn('h-full rounded-full', VIGENCIA_BAR_CLASS[vigencia.tone])}
            style={{ width: `${Math.round(vigencia.progress * 100)}%` }}
          />
        </div>
      ) : null}
      {vigencia.tone === 'none' ? (
        <p className="mt-1.5 text-caption text-muted-foreground">
          {vigencia.issuedText ? `${vigencia.issuedText} · ` : ''}
          {canWrite && editHref ? (
            <Link href={editHref} className="font-medium text-primary underline-offset-4 hover:underline">
              ponle fecha
            </Link>
          ) : (
            'sin fecha de vencimiento'
          )}
        </p>
      ) : (
        <div className="mt-1.5 flex justify-between gap-3 text-caption text-muted-foreground">
          <span>{vigencia.issuedText}</span>
          <span>{vigencia.lengthText}</span>
        </div>
      )}

      {canWrite ? (
        <>
          <div className="my-4 h-px bg-border" />
          <h3 className="text-[15px] font-semibold">¿Lo aceptó el cliente?</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {expired
              ? 'Sigue abierto para ti: puedes convertirlo, darle más tiempo o recordárselo al cliente.'
              : 'Se crea un ticket de trabajo con los mismos conceptos y precios, y el presupuesto queda como Aceptado.'}
          </p>
          <Button
            type="button"
            className="mt-3.5 h-11 w-full rounded-xl text-[15px] font-semibold"
            disabled={mutating}
            onClick={onConvert}
          >
            Convertir a ticket
          </Button>
        </>
      ) : null}
      <div className="mt-2.5 flex flex-col gap-2">
        {canWrite && onExtend ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-1.5 rounded-lg px-3 text-sm"
            disabled={mutating}
            onClick={onExtend}
          >
            <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
            Extender vigencia
          </Button>
        ) : null}
        {reminder ? (
          <Button asChild variant="outline" className="h-11 w-full gap-1.5 rounded-lg px-3 text-sm">
            <a
              href={reminder.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="presupuesto-remind-whatsapp"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              Recordar por WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );
};

/** Aceptado (PresuEstados): when and by whom, and the R ticket it became with its state and total. */
const PresupuestoAceptadoCard = ({
  expiresAt,
  convertedToTicketId,
  convertedTicket = null,
  activity,
}: Pick<PresupuestoDesktopProps, 'expiresAt' | 'convertedToTicketId' | 'convertedTicket'> & {
  activity: PresupuestoActivityEntry[];
}) => {
  const event = latestEvent(activity, 'presupuesto_converted');
  const acceptedOn = asDate(event?.createdAt);
  const acceptedAt = acceptedOn ? longDate(acceptedOn) : null;
  const subline = [event?.actorName?.trim() || null, describePresupuestoPastVigencia(expiresAt)]
    .filter(Boolean)
    .join(' · ');
  const ticketHref = convertedToTicketId ? `/tickets/${convertedToTicketId}` : null;

  return (
    <TicketDetailSectionCard
      aria-labelledby="presupuesto-accepted-heading"
      data-testid="presupuesto-accepted-card"
      className="border-emerald-500/40"
    >
      <h2 id="presupuesto-accepted-heading" className={RAIL_LABEL_CLASS}>
        Aceptado
      </h2>
      <p className="mt-2 flex items-center gap-2 text-[17px] font-semibold text-emerald-700 dark:text-emerald-300">
        <Check className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {acceptedAt ? `Aceptado el ${acceptedAt}` : 'Aceptado'}
      </p>
      {subline ? <p className="mt-1.5 text-caption text-muted-foreground">{subline}</p> : null}

      {ticketHref ? (
        <>
          <div className="my-4 h-px bg-border" />
          <p className={RAIL_LABEL_CLASS}>Se convirtió en el ticket</p>
          <Link
            href={ticketHref}
            data-testid="presupuesto-converted-ticket"
            className="mt-2.5 block rounded-xl border border-border px-3.5 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {convertedTicket ? (
              <>
                <span className="flex items-center justify-between gap-2.5">
                  <span className="font-mono text-sm font-medium tabular-nums">{convertedTicket.folio}</span>
                  <TicketDetailStatusPill
                    finished={convertedTicket.finished}
                    total={convertedTicket.total}
                    paid={convertedTicket.paid}
                  />
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-2.5">
                  <span className="text-sm text-muted-foreground">
                    {countLabel(convertedTicket.serviceCount, 'servicio', 'servicios')}
                    {convertedTicket.materialCount > 0
                      ? ` · ${countLabel(convertedTicket.materialCount, 'material', 'materiales')}`
                      : ''}
                  </span>
                  <span className="font-semibold tabular-nums" data-testid="presupuesto-converted-total">
                    <FormattedCurrency amount={convertedTicket.total ?? 0} />
                  </span>
                </span>
              </>
            ) : null}
            <span className="mt-2 block text-sm font-medium text-primary">Abrir ticket →</span>
          </Link>
          <p className="mt-3 text-caption leading-relaxed text-muted-foreground">
            El presupuesto ya no se edita ni se cancela; los cambios se hacen en el ticket.
          </p>
        </>
      ) : null}
    </TicketDetailSectionCard>
  );
};

/** Cancelado (PresuEstados): read-only, with Duplicar to quote it again. */
const PresupuestoCanceladoCard = ({
  expiresAt,
  canceledAt = null,
  canWrite,
  duplicating,
  onDuplicate,
  activity,
}: Pick<
  PresupuestoDesktopProps,
  'expiresAt' | 'canceledAt' | 'canWrite' | 'duplicating' | 'onDuplicate'
> & { activity: PresupuestoActivityEntry[] }) => {
  const event = latestEvent(activity, 'presupuesto_canceled');
  const when = asDate(event?.createdAt) ?? asDate(canceledAt);
  const canceledOn = when ? longDate(when) : null;
  const subline = [event?.actorName?.trim() || null, describePresupuestoPastVigencia(expiresAt)]
    .filter(Boolean)
    .join(' · ');

  return (
    <TicketDetailSectionCard
      aria-labelledby="presupuesto-canceled-heading"
      data-testid="presupuesto-canceled-card"
      className="bg-muted/30"
    >
      <h2 id="presupuesto-canceled-heading" className={RAIL_LABEL_CLASS}>
        Cancelado
      </h2>
      <p className="mt-2 flex items-center gap-2 text-[17px] font-semibold text-foreground/80">
        <Ban className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {canceledOn ? `Cancelado el ${canceledOn}` : 'Cancelado'}
      </p>
      {subline ? <p className="mt-1.5 text-caption text-muted-foreground">{subline}</p> : null}
      <div className="my-4 h-px bg-border" />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Solo lectura: no se edita, no se convierte, no se comparte. Para cotizar de nuevo, duplícalo y ajusta.
      </p>
      {canWrite ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3.5 h-11 w-full gap-2 rounded-xl text-[15px]"
          disabled={duplicating}
          onClick={onDuplicate}
        >
          <Copy className="h-4 w-4" aria-hidden />
          Duplicar presupuesto
        </Button>
      ) : null}
    </TicketDetailSectionCard>
  );
};

const PresupuestoClienteCard = (
  props: Pick<
    PresupuestoDesktopProps,
    | 'presupuestoId'
    | 'folio'
    | 'clientId'
    | 'clientName'
    | 'clientTel'
    | 'clientPhone'
    | 'clientEmail'
    | 'clientAddress'
    | 'companyName'
    | 'expiresAt'
    | 'total'
    | 'lines'
    | 'clientTicketCount'
    | 'clientPresupuestoCount'
  >,
) => {
  const {
    clientId,
    clientName,
    clientEmail = null,
    clientAddress = null,
    clientTicketCount = null,
    clientPresupuestoCount = null,
  } = props;
  const name = clientName?.trim() || 'Cliente';
  const phone = quotePhone(props);
  const email = clientEmail?.trim() || '';
  const address = clientAddress?.trim() || '';
  const whatsApp = phone ? buildWhatsAppQuoteShare(quoteShareInput(props)) : null;
  const documents = [
    clientTicketCount != null ? countLabel(clientTicketCount, 'ticket', 'tickets') : null,
    clientPresupuestoCount != null
      ? countLabel(clientPresupuestoCount, 'presupuesto', 'presupuestos')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TicketDetailSectionCard aria-labelledby="presupuesto-client-heading" data-testid="presupuesto-client-card">
      <h2 id="presupuesto-client-heading" className={RAIL_LABEL_CLASS}>
        Cliente
      </h2>
      <div className="mt-3 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-100 text-[13px] font-bold text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
        >
          {clientInitials(name)}
        </span>
        <div className="min-w-0">
          {clientId ? (
            <Link
              href={`/clients/${clientId}`}
              className="block font-semibold leading-snug text-foreground underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            >
              {name}
            </Link>
          ) : (
            <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{name}</p>
          )}
          {documents ? (
            <p className="mt-0.5 text-caption text-muted-foreground" data-testid="presupuesto-client-documents">
              {documents}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        {phone ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium tabular-nums" data-testid="presupuesto-client-phone">
                {formatPhoneDisplay(phone) ?? phone}
              </span>
              {whatsApp ? (
                <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-lg">
                  <a
                    href={whatsApp.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Escribir por WhatsApp"
                    data-testid="presupuesto-client-whatsapp"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dirección</dt>
          <dd className="min-w-0 text-right [overflow-wrap:anywhere]" data-testid="presupuesto-client-address">
            {address ? (
              address
            ) : (
              <>
                <span className="text-muted-foreground">Sin dirección</span>
                {clientId ? (
                  <>
                    {' · '}
                    <Link
                      href={`/clients/${clientId}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Agregar
                    </Link>
                  </>
                ) : null}
              </>
            )}
          </dd>
        </div>
        {email ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="min-w-0 text-right [overflow-wrap:anywhere]" data-testid="presupuesto-client-email">
              {email}
            </dd>
          </div>
        ) : null}
      </dl>

      {clientId ? (
        <Link
          href={`/clients/${clientId}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver cliente
        </Link>
      ) : null}
    </TicketDetailSectionCard>
  );
};

/** Canvas PresuA: «Presupuesto creado» over «10 oct · 08:23 · Jorge Climas». */
const PresupuestoActivityCard = ({ entries }: { entries: PresupuestoActivityEntry[] }) => {
  const recent = entries.slice(0, ACTIVITY_PREVIEW);

  return (
    <TicketDetailSectionCard
      aria-labelledby="presupuesto-activity-card-heading"
      data-testid="presupuesto-activity-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="presupuesto-activity-card-heading" className={RAIL_LABEL_CLASS}>
          Actividad · {entries.length}
        </h2>
        <button
          type="button"
          onClick={handleOpenActivity}
          className="inline-flex min-h-11 items-center text-caption font-medium text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver todo
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay eventos.</p>
      ) : (
        <ul className="mt-1 space-y-3.5">
          {recent.map((entry) => {
            const Icon = TIMELINE_ICONS[getTicketTimelineIcon(entry.eventType)] ?? Activity;
            const occurredAt = asDate(entry.createdAt);
            return (
              <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">
                    {formatPresupuestoActivityCardTitle(entry)}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {occurredAt ? format(occurredAt, 'd MMM · HH:mm', { locale: es }) : null}
                    {entry.actorName ? ` · ${entry.actorName}` : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </TicketDetailSectionCard>
  );
};

const PresupuestoActivityTimeline = ({
  entries,
  createdAt = null,
  updatedAt = null,
}: {
  entries: PresupuestoActivityEntry[];
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}) => {
  const [open, setOpen] = React.useState(false);
  const created = asDate(createdAt);
  const updated = asDate(updatedAt) ?? created;
  const handleToggle = () => {
    setOpen((value) => !value);
  };

  return (
    <TicketDetailSectionCard id="presupuesto-timeline" aria-labelledby="presupuesto-timeline-heading">
      <h2 id="presupuesto-timeline-heading" className="text-base font-semibold tracking-tight">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="presupuesto-timeline-body"
          onClick={handleToggle}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            Actividad
            <span className="font-normal text-muted-foreground"> · {entries.length}</span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </h2>
      <div id="presupuesto-timeline-body" hidden={!open} className="pt-2">
        {created ? (
          <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 gap-1.5">
              <dt>Creado</dt>
              <dd className="font-medium text-foreground">
                <FormattedDate date={created} withTime />
              </dd>
            </div>
            <div className="flex min-w-0 gap-1.5">
              <dt>Actualizado</dt>
              <dd className="font-medium text-foreground">
                <FormattedDate date={updated} withTime />
              </dd>
            </div>
          </dl>
        ) : null}
        {entries.length === 0 ? (
          <p className="rounded-lg bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Aún no hay eventos.
          </p>
        ) : (
          <ol className="space-y-1">
            {entries.map((entry) => {
              const formatted = formatTicketTimelineEntry(entry, { documentKind: 'presupuesto' });
              const Icon = TIMELINE_ICONS[formatted.icon] ?? Activity;
              const occurredAt = asDate(entry.createdAt) ?? new Date();
              return (
                <li key={entry.id}>
                  <div className="flex items-start gap-3 rounded-lg px-1 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium leading-snug text-foreground">{formatted.title}</p>
                      {formatted.details.length > 0 ? (
                        <ul className="list-disc space-y-0.5 pl-4 text-caption text-muted-foreground">
                          {formatted.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="text-caption text-muted-foreground">
                        {entry.actorName?.trim() || 'Sistema'}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-caption tabular-nums text-muted-foreground"
                      dateTime={occurredAt.toISOString()}
                      title={occurredAt.toLocaleString('es-MX')}
                    >
                      {formatRelativeActivityTime(occurredAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {entries.length > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-caption text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden />
            Eventos inmutables del historial de auditoría
          </p>
        ) : null}
      </div>
    </TicketDetailSectionCard>
  );
};

/**
 * Presupuesto detail from 1024px (ZIG-I28-5, ZIG-I29-1). The phone layout stays
 * in PresupuestoDetailLayout; this tree is not mounted below the desktop
 * breakpoint. The rail changes with the state: Vigencia y aceptación while it
 * is open or expired, Aceptado with its R ticket, or Cancelado.
 */
export const PresupuestoDesktop = ({
  activity = [],
  createdAt = null,
  updatedAt = null,
  ...props
}: PresupuestoDesktopProps) => {
  const stateCard =
    props.status === 'convertido' ? (
      <PresupuestoAceptadoCard
        expiresAt={props.expiresAt}
        convertedToTicketId={props.convertedToTicketId}
        convertedTicket={props.convertedTicket}
        activity={activity}
      />
    ) : props.status === 'cancelado' ? (
      <PresupuestoCanceladoCard
        expiresAt={props.expiresAt}
        canceledAt={props.canceledAt}
        canWrite={props.canWrite}
        duplicating={props.duplicating}
        onDuplicate={props.onDuplicate}
        activity={activity}
      />
    ) : (
      <PresupuestoVigenciaCard {...props} />
    );

  return (
    <TripledDashboardShell maxWidthClassName="max-w-[1200px]" contentClassName="space-y-4 md:space-y-6">
      {/* A container, not lg: the sidebar takes 256px, so at 1024 the page has ~720px (ZIG-I29). */}
      <div data-testid="presupuesto-desktop" className="@container flex flex-col gap-4 md:gap-6">
        <PresupuestoDesktopHeader {...props} />
        <div
          data-testid="presupuesto-desktop-grid"
          className="grid items-start gap-4 md:gap-6 @min-[60rem]:grid-cols-[minmax(0,1fr)_300px] @min-[60rem]:grid-rows-[auto_1fr] @min-[60rem]:gap-x-8 @min-[72rem]:grid-cols-[minmax(0,1fr)_340px]"
        >
          <aside
            aria-label="Vigencia, cliente y actividad"
            data-testid="presupuesto-desktop-rail"
            className="order-2 grid min-w-0 items-start gap-4 @min-[40rem]:grid-cols-2 @min-[60rem]:sticky @min-[60rem]:top-20 @min-[60rem]:order-none @min-[60rem]:col-start-2 @min-[60rem]:row-span-2 @min-[60rem]:row-start-1 @min-[60rem]:flex @min-[60rem]:flex-col @min-[60rem]:gap-6"
          >
            {stateCard}
            <PresupuestoClienteCard
              presupuestoId={props.presupuestoId}
              folio={props.folio}
              clientId={props.clientId}
              clientName={props.clientName}
              clientTel={props.clientTel}
              clientPhone={props.clientPhone}
              clientEmail={props.clientEmail}
              clientAddress={props.clientAddress}
              companyName={props.companyName}
              expiresAt={props.expiresAt}
              total={props.total}
              lines={props.lines}
              clientTicketCount={props.clientTicketCount}
              clientPresupuestoCount={props.clientPresupuestoCount}
            />
            <PresupuestoActivityCard entries={activity} />
          </aside>
          <div className="order-1 min-w-0 @min-[60rem]:order-none @min-[60rem]:col-start-1 @min-[60rem]:row-start-1">
            <PresupuestoDesktopDocument
              lines={props.lines}
              total={props.total}
              workNotes={props.workNotes}
              conditionsEditHref={props.canWrite && props.isMutable ? props.editHref : null}
            />
          </div>
          <div className="order-3 min-w-0 @min-[60rem]:order-none @min-[60rem]:col-start-1 @min-[60rem]:row-start-2">
            <PresupuestoActivityTimeline entries={activity} createdAt={createdAt} updatedAt={updatedAt} />
          </div>
        </div>
      </div>
    </TripledDashboardShell>
  );
};
