'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  Ban,
  CalendarClock,
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
  Share2,
  Ticket,
} from 'lucide-react';

import { DocumentLineRow } from '@/components/documents/document-line-row';
import { DocumentLinesDensitySwitch } from '@/components/documents/document-lines-density-switch';
import { MoneyFigure } from '@/components/documents/money-figure';
import { PresupuestoConditions } from '@/components/presupuestos/presupuesto-conditions';
import { PresupuestoStatusPill } from '@/components/presupuestos/presupuesto-status-pill';
import type { ReviewLine } from '@/components/tickets/review/document-review-parts';
import { FormattedDate } from '@/components/formatted-date';
import {
  TicketDetailSectionCard,
  TicketDetailSectionHeading,
} from '@/components/tickets/detail/ticket-detail-section-card';
import { TripledDashboardShell } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLongDate } from '@/lib/format-long-date';
import { formatRelativeActivityTime } from '@/lib/format-relative-time';
import { materialDraftAmount } from '@/lib/material-drafts';
import { sumLineTotals, sumMaterialTotals } from '@/lib/money';
import { describePresupuestoVigencia, type PresupuestoVigencia } from '@/lib/presupuesto-vigencia';
import { reviewLineAmount } from '@/lib/review-lines';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';
import {
  formatTicketTimelineEntry,
  type TicketTimelineIconKey,
} from '@/lib/ticket-audit-display';
import { cn } from '@/lib/utils';
import { buildWhatsAppQuoteShare } from '@/lib/whatsapp-share';

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

const handleOpenActivity = () => {
  const heading = document.getElementById('presupuesto-timeline-heading');
  const toggle = heading?.querySelector('button');
  if (toggle instanceof HTMLButtonElement && toggle.getAttribute('aria-expanded') === 'false') {
    toggle.click();
  }
  document.getElementById('presupuesto-timeline')?.scrollIntoView?.({ block: 'start' });
};

type HeaderProps = Pick<
  PresupuestoDesktopProps,
  | 'presupuestoId'
  | 'folio'
  | 'clientId'
  | 'clientName'
  | 'ticketDate'
  | 'status'
  | 'editHref'
  | 'canWrite'
  | 'canInvoice'
  | 'isMutable'
  | 'mutating'
  | 'sharing'
  | 'downloading'
  | 'duplicating'
  | 'onShare'
  | 'onDownload'
  | 'onConvert'
  | 'onCancel'
  | 'onDuplicate'
>;

const PresupuestoDesktopHeader = ({
  presupuestoId,
  folio = null,
  clientId,
  clientName,
  ticketDate,
  status,
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
}: HeaderProps) => {
  const issued = formatLongDate(ticketDate);
  const label = folio || `#${presupuestoId}`;
  const showConvert = canWrite && isMutable;
  const showEdit = canWrite && isMutable && Boolean(editHref);
  const showShare = status !== 'cancelado';
  const showCancel = canWrite && isMutable;
  const showMenu = canWrite || canInvoice;
  const name = clientName?.trim() || 'Cliente';

  return (
    <header className="flex min-w-0 flex-col gap-3" data-testid="presupuesto-header">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
          Presupuesto {label}
        </p>
        <PresupuestoStatusPill status={status} />
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
        {issued ? <p className="text-sm text-muted-foreground">Emitido el {issued}</p> : null}
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
            Convertir
          </Button>
        ) : null}
        {showShare ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl"
            aria-label="Compartir presupuesto"
            disabled={sharing}
            onClick={onShare}
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden />
            )}
            Compartir
          </Button>
        ) : null}
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
              {canWrite ? (
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
}: Pick<PresupuestoDesktopProps, 'lines' | 'total' | 'workNotes'>) => {
  const materialCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const servicesTotal = sumLineTotals(lines.map((line) => ({ quantity: line.quantity, price: line.price })));
  const materialsTotal = sumMaterialTotals(lines.flatMap((line) => line.materials ?? []));
  const notes = workNotes?.trim() ?? '';

  return (
    <TicketDetailSectionCard aria-labelledby="presupuesto-document-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="presupuesto-document-heading" className="text-[15px] font-semibold">
          Conceptos
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

      <div className="mt-5">
        {notes ? (
          <PresupuestoConditions notes={notes} />
        ) : (
          <section aria-labelledby="presupuesto-conditions-heading" data-testid="presupuesto-conditions">
            <h2 id="presupuesto-conditions-heading" className="mb-1.5 text-[15px] font-semibold">
              Condiciones
            </h2>
            <p className="text-caption text-muted-foreground">Sin condiciones</p>
          </section>
        )}
      </div>
    </TicketDetailSectionCard>
  );
};

const PresupuestoEstadoCard = ({
  status,
  expiresAt,
  isMutable,
  canWrite,
  mutating,
  convertedToTicketId,
  onConvert,
}: Pick<
  PresupuestoDesktopProps,
  'status' | 'expiresAt' | 'isMutable' | 'canWrite' | 'mutating' | 'convertedToTicketId' | 'onConvert'
>) => {
  const vigencia = describePresupuestoVigencia({ expiresAt, status });
  const showConvert = canWrite && isMutable;

  return (
    <TicketDetailSectionCard aria-labelledby="presupuesto-estado-heading" data-testid="presupuesto-estado-card">
      <TicketDetailSectionHeading id="presupuesto-estado-heading" title="Estado" />
      <p className="text-caption text-muted-foreground">Vigencia</p>
      <p
        className={cn('mt-1 flex items-start gap-2 text-sm', vigenciaClass(vigencia.tone))}
        data-testid="presupuesto-desktop-expires"
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{vigencia.text}</span>
      </p>
      {showConvert ? (
        <Button
          type="button"
          className="mt-4 h-11 w-full rounded-xl text-[15px] font-semibold"
          disabled={mutating}
          onClick={onConvert}
        >
          Convertir en ticket
        </Button>
      ) : null}
      {status === 'convertido' && convertedToTicketId ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Aceptado · convertido en ticket</p>
          <Link
            href={`/tickets/${convertedToTicketId}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
            data-testid="presupuesto-converted-ticket"
          >
            Ver ticket
          </Link>
        </div>
      ) : null}
      {status === 'cancelado' ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Ban className="h-4 w-4 shrink-0" aria-hidden />
          Presupuesto cancelado. Sólo lectura.
        </p>
      ) : null}
    </TicketDetailSectionCard>
  );
};

const PresupuestoClienteCard = ({
  presupuestoId,
  folio = null,
  clientId,
  clientName,
  clientTel = null,
  clientPhone = null,
  clientEmail = null,
  clientAddress = null,
  companyName = null,
  expiresAt,
  total,
  lines,
}: Pick<
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
>) => {
  const name = clientName?.trim() || 'Cliente';
  const phone = clientPhone?.trim() || clientTel?.trim() || '';
  const email = clientEmail?.trim() || '';
  const address = clientAddress?.trim() || '';
  const servicesSummary = lines
    .slice(0, 3)
    .map((line) => line.name)
    .join(', ');
  const whatsApp = phone
    ? buildWhatsAppQuoteShare({
        phone,
        clientName: name,
        ticketId: presupuestoId,
        folio,
        total,
        servicesSummary,
        validUntil: expiresAt,
        companyName,
      })
    : null;

  return (
    <TicketDetailSectionCard aria-labelledby="presupuesto-client-heading" data-testid="presupuesto-client-card">
      <TicketDetailSectionHeading id="presupuesto-client-heading" title="Cliente" />
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {clientInitials(name)}
        </span>
        <div className="min-w-0">
          {clientId ? (
            <Link
              href={`/clients/${clientId}`}
              className="block font-medium text-foreground underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            >
              {name}
            </Link>
          ) : (
            <p className="font-medium [overflow-wrap:anywhere]">{name}</p>
          )}
        </div>
      </div>

      {phone ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Teléfono</p>
            <p className="text-sm tabular-nums" data-testid="presupuesto-client-phone">
              {phone}
            </p>
          </div>
          {whatsApp ? (
            <Button asChild variant="outline" size="icon" className="shrink-0">
              <a
                href={whatsApp.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                data-testid="presupuesto-client-whatsapp"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-caption text-muted-foreground">Dirección</p>
        {address ? (
          <p className="text-sm [overflow-wrap:anywhere]" data-testid="presupuesto-client-address">
            {address}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="presupuesto-client-address">
            Sin dirección
          </p>
        )}
      </div>

      {email ? (
        <div className="mt-3">
          <p className="text-caption text-muted-foreground">Correo</p>
          <p className="text-sm [overflow-wrap:anywhere]" data-testid="presupuesto-client-email">
            {email}
          </p>
        </div>
      ) : null}

      {clientId ? (
        <Link
          href={`/clients/${clientId}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver cliente
        </Link>
      ) : null}
    </TicketDetailSectionCard>
  );
};

const PresupuestoActivityCard = ({ entries }: { entries: PresupuestoActivityEntry[] }) => {
  const recent = entries.slice(0, ACTIVITY_PREVIEW);

  return (
    <TicketDetailSectionCard
      aria-labelledby="presupuesto-activity-card-heading"
      data-testid="presupuesto-activity-card"
    >
      <TicketDetailSectionHeading
        id="presupuesto-activity-card-heading"
        title="Actividad"
        count={entries.length}
      />
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay eventos.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((entry) => {
            const formatted = formatTicketTimelineEntry(entry);
            const occurredAt = asDate(entry.createdAt);
            return (
              <li key={entry.id} className="text-sm">
                <p className="font-medium [overflow-wrap:anywhere]">{formatted.title}</p>
                <p className="text-caption text-muted-foreground">
                  {occurredAt ? <FormattedDate withTime date={occurredAt} /> : null}
                  {entry.actorName ? ` · ${entry.actorName}` : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={handleOpenActivity}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todo
      </button>
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
              const formatted = formatTicketTimelineEntry(entry);
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
 * Presupuesto detail from 1024px (ZIG-I28-5). The phone layout stays in
 * PresupuestoDetailLayout; this tree is not mounted below the desktop breakpoint.
 */
export const PresupuestoDesktop = ({
  activity = [],
  createdAt = null,
  updatedAt = null,
  ...props
}: PresupuestoDesktopProps) => {
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
            aria-label="Estado del presupuesto"
            data-testid="presupuesto-desktop-rail"
            className="order-2 grid min-w-0 items-start gap-4 @min-[40rem]:grid-cols-2 @min-[60rem]:sticky @min-[60rem]:top-20 @min-[60rem]:order-none @min-[60rem]:col-start-2 @min-[60rem]:row-span-2 @min-[60rem]:row-start-1 @min-[60rem]:flex @min-[60rem]:flex-col @min-[60rem]:gap-6"
          >
            <PresupuestoEstadoCard
              status={props.status}
              expiresAt={props.expiresAt}
              isMutable={props.isMutable}
              canWrite={props.canWrite}
              mutating={props.mutating}
              convertedToTicketId={props.convertedToTicketId}
              onConvert={props.onConvert}
            />
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
            />
            <PresupuestoActivityCard entries={activity} />
          </aside>
          <div className="order-1 min-w-0 @min-[60rem]:order-none @min-[60rem]:col-start-1 @min-[60rem]:row-start-1">
            <PresupuestoDesktopDocument lines={props.lines} total={props.total} workNotes={props.workNotes} />
          </div>
          <div className="order-3 min-w-0 @min-[60rem]:order-none @min-[60rem]:col-start-1 @min-[60rem]:row-start-2">
            <PresupuestoActivityTimeline entries={activity} createdAt={createdAt} updatedAt={updatedAt} />
          </div>
        </div>
      </div>
    </TripledDashboardShell>
  );
};
