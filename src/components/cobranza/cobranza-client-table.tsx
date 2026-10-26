'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, MessageCircle, MoreVertical, UserRound } from 'lucide-react';
import { CobranzaDaysCell, cobranzaDaysClassName } from '@/components/cobranza/cobranza-columns';
import { CobranzaRowActions } from '@/components/cobranza/cobranza-row-actions';
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
import type { CobranzaClientGroup, CobranzaRow } from '@/lib/cobranza';
import { formatListDate } from '@/lib/format-list-date';
import { TICKET_PAYMENT_STATUS_LABEL } from '@/lib/ticket-payment-status';
import { canCollectTicketPayment } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';
import { buildWhatsAppStatementShare } from '@/lib/whatsapp-share';

type CobranzaClientTableProps = {
  groups: CobranzaClientGroup[];
  canWrite: boolean;
  companyId: number | null;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const lastPaymentLabel = (value: Date | null): string =>
  value ? formatListDate(new Date(value)) : 'Ningún pago';

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
    <Button asChild variant="outline" size="sm">
      <a
        href={share.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Enviar estado de cuenta por WhatsApp a ${group.client_name ?? 'el cliente'}`}
        data-testid="cobranza-statement"
      >
        <MessageCircle className="h-4 w-4" aria-hidden data-icon="inline-start" />
        Estado de cuenta
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
    <div className="relative flex items-center justify-end">
      <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-background p-1 opacity-0 shadow-sm ring-1 ring-border/60 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {canCollect ? (
          group.tickets.length === 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
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

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Por cliente (ZIG-I31-3): one row per client, larger saldo first, that opens
 * to its tickets with Cobrar and Recordar each.
 */
export const CobranzaClientTable = ({
  groups,
  canWrite,
  companyId,
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
          <TableHead>Cliente</TableHead>
          <TableHead className="w-24 text-right">Tickets</TableHead>
          <TableHead className="w-32">Más antiguo</TableHead>
          <TableHead className="hidden w-32 lg:table-cell">Último pago</TableHead>
          <TableHead className="w-32 text-right">Saldo total</TableHead>
          <TableHead className="w-14">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const open = expanded.has(group.key);
          const name = group.client_name?.trim() || 'Sin cliente';
          const detailId = `cobranza-client-${group.key.replace(/[^\w-]/g, '_')}`;
          return (
            <React.Fragment key={group.key}>
              <TableRow
                className="group h-14 cursor-pointer"
                data-testid="cobranza-client-row"
                onClick={() => toggle(group.key)}
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={`${open ? 'Ocultar' : 'Ver'} los tickets de ${name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(group.key);
                      }}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-5" title={name}>
                        {name}
                      </p>
                      {group.client_tel ? (
                        <p className="truncate text-caption leading-4 text-muted-foreground">
                          {group.client_tel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums" data-testid="cobranza-client-count">
                  {group.tickets.length}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      cobranzaDaysClassName(group.oldestDays),
                    )}
                  >
                    {plural(group.oldestDays, 'día', 'días')}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {lastPaymentLabel(group.last_payment_at)}
                </TableCell>
                <TableCell
                  className="text-right font-semibold tabular-nums text-amber-800 dark:text-amber-300"
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
              {open ? (
                <TableRow id={detailId} className="hover:bg-transparent">
                  <TableCell colSpan={6} className="!h-auto bg-muted/30 !px-0 !py-0">
                    <ul className="divide-y divide-border/60" aria-label={`Tickets de ${name}`}>
                      {group.tickets.map((row) => (
                        <li
                          key={row.id}
                          className="group grid grid-cols-[5rem_minmax(0,1fr)_7rem_8rem_9rem_7rem_3.5rem] items-center gap-3 py-2 pl-14 pr-3"
                          data-testid="cobranza-client-ticket"
                        >
                          <Link
                            href={`/tickets/${row.id}`}
                            className="font-mono text-caption tabular-nums underline-offset-4 hover:underline"
                          >
                            {row.folio}
                          </Link>
                          <div className="min-w-0">
                            <p className="truncate">{row.services_summary ?? 'Sin servicios'}</p>
                            <p className="text-caption text-muted-foreground">
                              {formatListDate(new Date(row.ticket_date ?? row.created_at))}
                            </p>
                          </div>
                          <span className="text-caption text-muted-foreground">
                            {TICKET_PAYMENT_STATUS_LABEL[row.paymentStatus]}
                          </span>
                          <CobranzaDaysCell
                            days={row.daysOutstanding}
                            daysSinceLastPayment={row.daysSinceLastPayment}
                          />
                          <span className="text-right text-caption tabular-nums text-muted-foreground">
                            <FormattedCurrency amount={row.paid ?? 0} /> de{' '}
                            <FormattedCurrency amount={row.total} />
                          </span>
                          <span className="text-right font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                            <FormattedCurrency amount={row.balanceDue} />
                          </span>
                          <CobranzaRowActions
                            row={row}
                            canWrite={canWrite}
                            companyId={companyId}
                            companyName={companyName}
                            onCollect={onCollect}
                          />
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ) : null}
            </React.Fragment>
          );
        })}
      </TableBody>
    </table>
  );
};
