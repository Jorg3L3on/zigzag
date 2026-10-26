'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, MessageCircle, MoreVertical, UserRound } from 'lucide-react';
import {
  cobranzaDaysClassName,
  formatCobranzaDate,
  formatPaymentWhen,
} from '@/components/cobranza/cobranza-columns';
import {
  COLLECT_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
} from '@/components/cobranza/cobranza-row-actions';
import { COBRANZA_TABLE_CLASS } from '@/components/cobranza/cobranza-ticket-table';
import { FormattedCurrency } from '@/components/formatted-currency';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import { usePermissions } from '@/hooks/use-permissions';
import { getDaysOutstanding, type CobranzaClientGroup, type CobranzaRow } from '@/lib/cobranza';
import { formatPhoneDisplay } from '@/lib/phone-links';
import {
  formatTicketListAmount,
  TICKET_PAYMENT_STATUS_LABEL,
} from '@/lib/ticket-payment-status';
import { canCollectTicketPayment } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';
import { buildWhatsAppBalanceShare, buildWhatsAppStatementShare } from '@/lib/whatsapp-share';

type CobranzaClientTableProps = {
  groups: CobranzaClientGroup[];
  canWrite: boolean;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** «hace 1 día», «3 ene 26», «sin pagos» (canvas CobB). */
const lastPaymentLabel = (value: Date | null): string => {
  if (!value) return 'sin pagos';
  return formatPaymentWhen(value, getDaysOutstanding(new Date(value))) ?? 'sin pagos';
};

/** «Estado de cuenta»: one WhatsApp with every ticket of the client (ZIG-I31-3). */
const StatementButton = ({
  group,
  companyName,
}: {
  group: CobranzaClientGroup;
  companyName: string | null;
}) => {
  const payment = useCompanyPaymentInfo();
  const share = buildWhatsAppStatementShare({
    phone: group.client_tel,
    clientName: group.client_name,
    tickets: group.tickets.map((row) => ({
      ticketId: row.id,
      folio: row.folio,
      date: row.ticket_date ?? row.created_at,
      balanceDue: row.balanceDue,
    })),
    total: group.balanceDue,
    companyName,
    payment,
  });
  if (!share) return null;
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-[30px] w-[30px] rounded-lg px-0 text-[13px] xl:w-auto xl:px-2.5"
    >
      <a
        href={share.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Enviar estado de cuenta por WhatsApp a ${group.client_name ?? 'el cliente'}`}
        title="Estado de cuenta"
        data-testid="cobranza-statement"
      >
        {/* Below 1280 the column only fits the icon; the label comes back from xl. */}
        <MessageCircle className="h-3.5 w-3.5 xl:hidden" aria-hidden />
        <span className="hidden xl:inline">Estado de cuenta</span>
      </a>
    </Button>
  );
};

const GroupActions = ({
  group,
  canCollect,
  companyName,
  onCollect,
}: {
  group: CobranzaClientGroup;
  canCollect: boolean;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
}) => {
  const name = group.client_name ?? 'el cliente';
  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* In the Acciones column, shown with the row (hover or keyboard focus), as in CobB. */}
      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {canCollect ? (
          group.tickets.length === 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={COLLECT_BUTTON_CLASS}
              onClick={() => onCollect(group.tickets[0])}
              aria-label={`Cobrar el ticket ${group.tickets[0].folio}`}
            >
              Cobrar
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={COLLECT_BUTTON_CLASS}
                  aria-label={`Cobrar un ticket de ${name}`}
                >
                  Cobrar
                  <ChevronDown className="h-4 w-4" aria-hidden data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>¿Qué ticket te pagó?</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.tickets.map((row) => (
                  <DropdownMenuItem key={row.id} onSelect={() => onCollect(row)}>
                    <span className="font-mono text-caption">{row.folio}</span>
                    <span className="ml-auto pl-4 tabular-nums">
                      <FormattedCurrency amount={row.balanceDue} />
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : null}
        <StatementButton group={group} companyName={companyName} />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Más acciones de ${name}`}>
            <MoreVertical className="h-4 w-4" aria-hidden data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {group.client_id != null ? (
            <DropdownMenuItem asChild>
              <Link href={`/clients/${group.client_id}`}>
                <UserRound className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
                Ver cliente
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>Sin cliente registrado</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/** Cobrar and Recordar on one ticket of an opened client, always visible (canvas CobB). */
const TicketActions = ({
  row,
  canCollect,
  companyName,
  onCollect,
}: {
  row: CobranzaRow;
  canCollect: boolean;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
}) => {
  const payment = useCompanyPaymentInfo();
  const share = buildWhatsAppBalanceShare({
    phone: row.client_tel,
    clientName: row.client_name,
    ticketId: row.id,
    folio: row.folio,
    balanceDue: row.balanceDue,
    companyName,
    payment,
  });
  return (
    <div className="flex items-center justify-end gap-1.5">
      {canCollect ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[30px] rounded-lg px-2.5 text-[13px]"
          onClick={() => onCollect(row)}
          aria-label={`Cobrar el ticket ${row.folio}`}
        >
          Cobrar
        </Button>
      ) : null}
      {share ? (
        <Button asChild variant="outline" size="icon" className={ICON_BUTTON_CLASS}>
          <a
            href={share.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Recordar por WhatsApp el ticket ${row.folio}`}
            title="Recordar por WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          </a>
        </Button>
      ) : null}
    </div>
  );
};

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Por cliente (ZIG-I31-3, canvas CobB): one row per client in the chosen order
 * (Mayor saldo by default) that opens to its tickets, aligned to the same columns.
 */
export const CobranzaClientTable = ({
  groups,
  canWrite,
  companyName,
  onCollect,
}: CobranzaClientTableProps) => {
  const { can } = usePermissions();
  const canCollect = canWrite && canCollectTicketPayment(can);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <table className={COBRANZA_TABLE_CLASS} aria-label="Clientes con saldo">
      <TableHeader className="sticky top-16 z-20 bg-background">
        <TableRow>
          <TableHead className="w-12">
            <span className="sr-only">Abrir</span>
          </TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="w-[6.5rem]">Tickets</TableHead>
          <TableHead className="w-32">Más antiguo</TableHead>
          {/* At 1024 with the sidebar open, Último pago yields so the client name keeps room. */}
          <TableHead className="hidden w-36 xl:table-cell">Último pago</TableHead>
          <TableHead className="w-32 text-right">Saldo total</TableHead>
          <TableHead className="w-36 xl:w-60">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const open = expanded.has(group.key);
          const name = group.client_name?.trim() || 'Sin cliente';
          const phone = formatPhoneDisplay(group.client_tel);
          const detailId = `cobranza-client-${group.key.replace(/[^\w-]/g, '_')}`;
          return (
            <React.Fragment key={group.key}>
              <TableRow
                className="group h-14 cursor-pointer"
                data-testid="cobranza-client-row"
                onClick={() => toggle(group.key)}
              >
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-expanded={open}
                    aria-controls={detailId}
                    aria-label={`${open ? 'Ocultar' : 'Ver'} los tickets de ${name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(group.key);
                    }}
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-[1.3]" title={name}>
                      {name}
                    </p>
                    {phone ? (
                      <p className="truncate text-xs tabular-nums leading-4 text-muted-foreground">
                        {phone}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums" data-testid="cobranza-client-count">
                  {plural(group.tickets.length, 'ticket', 'tickets')}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'tabular-nums',
                      group.oldestDays > 90 && 'font-semibold',
                      cobranzaDaysClassName(group.oldestDays),
                    )}
                  >
                    {plural(group.oldestDays, 'día', 'días')}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    'hidden tabular-nums xl:table-cell',
                    group.last_payment_at
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-muted-foreground',
                  )}
                >
                  {lastPaymentLabel(group.last_payment_at)}
                </TableCell>
                <TableCell
                  className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                  data-testid="cobranza-client-balance"
                >
                  <FormattedCurrency amount={group.balanceDue} />
                </TableCell>
                <TableCell onClick={stop} onPointerDown={stop} onKeyDown={stop}>
                  <GroupActions
                    group={group}
                    canCollect={canCollect}
                    companyName={companyName}
                    onCollect={onCollect}
                  />
                </TableCell>
              </TableRow>
              {open
                ? group.tickets.map((row, index) => (
                    <TableRow
                      key={row.id}
                      id={index === 0 ? detailId : undefined}
                      className={cn(
                        'bg-slate-50 text-[13px] hover:bg-slate-50 dark:bg-muted/40 dark:hover:bg-muted/40 [&>td]:!h-auto [&>td]:!py-2',
                        index === group.tickets.length - 1 && 'border-b-border/70',
                      )}
                      data-testid="cobranza-client-ticket"
                    >
                      <TableCell />
                      <TableCell>
                        <p className="truncate pl-2">
                          <Link
                            href={`/tickets/${row.id}`}
                            className="font-mono font-medium tabular-nums text-primary underline-offset-4 hover:underline"
                          >
                            {row.folio}
                          </Link>{' '}
                          <span className="text-muted-foreground">
                            · {formatCobranzaDate(row.ticket_date ?? row.created_at)}
                            {row.services_summary ? ` · ${row.services_summary}` : ''}
                          </span>
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {TICKET_PAYMENT_STATUS_LABEL[row.paymentStatus]}
                      </TableCell>
                      <TableCell className={cn('tabular-nums', cobranzaDaysClassName(row.daysOutstanding))}>
                        {plural(row.daysOutstanding, 'día', 'días')}
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground xl:table-cell">
                        {(row.paid ?? 0) > 0.01
                          ? `${formatTicketListAmount(row.paid)} de ${formatTicketListAmount(row.total)}`
                          : 'sin pagos'}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        <FormattedCurrency amount={row.balanceDue} />
                      </TableCell>
                      <TableCell>
                        <TicketActions
                          row={row}
                          canCollect={canCollect}
                          companyName={companyName}
                          onCollect={onCollect}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </React.Fragment>
          );
        })}
      </TableBody>
    </table>
  );
};
