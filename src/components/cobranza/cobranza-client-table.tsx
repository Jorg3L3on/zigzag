'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, MessageCircle, UserRound } from 'lucide-react';
import {
  cobranzaDaysClassName,
  formatPaymentWhen,
} from '@/components/cobranza/cobranza-columns';
import {
  COLLECT_BUTTON_CLASS,
  CobranzaRowActions,
  openWhatsApp,
} from '@/components/cobranza/cobranza-row-actions';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  ListClickableRow,
  ListRowMenu,
  ListShortDate,
  ListSortableHeader,
  ListTable,
  listColumnClassName,
  type ListRowMenuItem,
} from '@/components/list-page';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
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
import { buildWhatsAppStatementShare } from '@/lib/whatsapp-share';

type CobranzaClientTableProps = {
  groups: CobranzaClientGroup[];
  canWrite: boolean;
  companyId: number | null;
  companyName: string | null;
  onCollect: (row: CobranzaRow) => void;
  /** The server order: `days` (Más antiguo) or `balance` (Saldo total), either direction. */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  /** Refreshing: the rows stay, dimmed (ZIG-I33 §8). */
  busy?: boolean;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** «hace 1 día», «3 ene 2025», «sin pagos» (canvas CobB). */
const lastPaymentLabel = (value: Date | null): string => {
  if (!value) return 'sin pagos';
  return formatPaymentWhen(value, getDaysOutstanding(new Date(value))) ?? 'sin pagos';
};

const detailIdOf = (group: CobranzaClientGroup) =>
  `cobranza-client-${group.key.replace(/[^\w-]/g, '_')}`;

/**
 * Cobrar (▾ when the client owes on several tickets) always visible, then the ⋯ with
 * the estado de cuenta by WhatsApp (ZIG-I31-3) and Ver cliente (ZIG-I33-3).
 */
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
  const router = useRouter();
  const payment = useCompanyPaymentInfo();
  const name = group.client_name ?? 'el cliente';
  const statement = buildWhatsAppStatementShare({
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

  const items: ListRowMenuItem[] = [];
  if (statement) {
    items.push({
      label: 'Estado de cuenta por WhatsApp',
      icon: <MessageCircle className="h-4 w-4" aria-hidden />,
      onSelect: () => openWhatsApp(statement.href),
    });
  }
  if (group.client_id != null) {
    const clientId = group.client_id;
    items.push({
      label: 'Ver cliente',
      icon: <UserRound className="h-4 w-4" aria-hidden />,
      onSelect: () => router.push(`/clients/${clientId}`),
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
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
            {/* The menu renders in a portal, but its clicks still bubble to the row. */}
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
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
      {items.length > 0 ? (
        <ListRowMenu label={`Más acciones de ${name}`} items={items} />
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
      )}
    </div>
  );
};

/**
 * Por cliente (ZIG-I31-3, canvas CobB): one row per client in the server order
 * (Mayor saldo by default) that opens to its tickets by click, Enter or Space,
 * aligned to the same columns, on the shared list table (ZIG-I33-3).
 */
export const CobranzaClientTable = ({
  groups,
  canWrite,
  companyId,
  companyName,
  onCollect,
  sorting,
  onSortingChange,
  busy = false,
}: CobranzaClientTableProps) => {
  const { can } = usePermissions();
  const canCollect = canWrite && canCollectTicketPayment(can);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const toggle = React.useCallback(
    (key: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    [],
  );

  const columns = React.useMemo<ColumnDef<CobranzaClientGroup>[]>(
    () => [
      {
        id: 'open',
        enableSorting: false,
        meta: { className: 'w-12' },
        header: () => <span className="sr-only">Abrir</span>,
        cell: ({ row }) => {
          const group = row.original;
          const open = expanded.has(group.key);
          const name = group.client_name?.trim() || 'Sin cliente';
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              aria-expanded={open}
              aria-controls={detailIdOf(group)}
              aria-label={`${open ? 'Ocultar' : 'Ver'} los tickets de ${name}`}
              onClick={() => toggle(group.key)}
            >
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
          );
        },
      },
      {
        id: 'client',
        enableSorting: false,
        header: () => <span>Cliente</span>,
        cell: ({ row }) => {
          const name = row.original.client_name?.trim() || 'Sin cliente';
          const phone = formatPhoneDisplay(row.original.client_tel);
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-[1.3]" title={name}>
                {name}
              </p>
              {phone ? (
                <p className="truncate tabular-nums leading-4 text-muted-foreground md:text-xs">
                  {phone}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'count',
        enableSorting: false,
        meta: { className: 'w-[6.5rem]' },
        header: () => <span>Tickets</span>,
        cell: ({ row }) => (
          <span className="tabular-nums" data-testid="cobranza-client-count">
            {plural(row.original.tickets.length, 'ticket', 'tickets')}
          </span>
        ),
      },
      {
        id: 'days',
        accessorFn: (group) => group.oldestDays,
        sortDescFirst: true,
        meta: { className: 'w-32' },
        header: ({ column }) => <ListSortableHeader column={column} label="Más antiguo" />,
        cell: ({ row }) => (
          <span
            className={cn(
              'tabular-nums',
              row.original.oldestDays > 90 && 'font-semibold',
              cobranzaDaysClassName(row.original.oldestDays),
            )}
          >
            {plural(row.original.oldestDays, 'día', 'días')}
          </span>
        ),
      },
      {
        id: 'lastPayment',
        enableSorting: false,
        // At 1024 with the sidebar open, Último pago yields so the client name keeps room.
        meta: { className: 'hidden w-36 xl:table-cell' },
        header: () => <span>Último pago</span>,
        cell: ({ row }) => (
          <span
            className={cn(
              'tabular-nums',
              row.original.last_payment_at
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-muted-foreground',
            )}
          >
            {lastPaymentLabel(row.original.last_payment_at)}
          </span>
        ),
      },
      {
        id: 'balance',
        accessorFn: (group) => group.balanceDue,
        sortDescFirst: true,
        meta: { className: 'w-32', align: 'right' },
        header: ({ column }) => (
          <ListSortableHeader column={column} label="Saldo total" align="right" />
        ),
        cell: ({ row }) => (
          <span
            className="font-semibold text-amber-700 dark:text-amber-300"
            data-testid="cobranza-client-balance"
          >
            <FormattedCurrency amount={row.original.balanceDue} />
          </span>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        // «Cobrar ▾» and the ⋯.
        meta: { className: 'w-[9.5rem]' },
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <GroupActions
            group={row.original}
            canCollect={canCollect}
            companyName={companyName}
            onCollect={onCollect}
          />
        ),
      },
    ],
    [canCollect, companyName, expanded, onCollect, toggle],
  );

  const table = useReactTable({
    data: groups,
    columns,
    getRowId: (group) => group.key,
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ListTable
      table={table}
      dense
      busy={busy}
      ariaLabel="Clientes con saldo"
      renderRow={(row) => {
        const group = row.original;
        const open = expanded.has(group.key);
        const detailId = detailIdOf(group);
        return (
          <React.Fragment key={row.id}>
            <ListClickableRow
              data-testid="cobranza-client-row"
              selected={open}
              onOpen={() => toggle(group.key)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={listColumnClassName(cell.column.columnDef.meta)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </ListClickableRow>
            {open
              ? group.tickets.map((ticketRow, index) => (
                  <TableRow
                    key={ticketRow.id}
                    id={index === 0 ? detailId : undefined}
                    className={cn(
                      'bg-slate-50 hover:bg-slate-50 dark:bg-muted/40 dark:hover:bg-muted/40 md:text-[13px] [&>td]:!h-auto [&>td]:!py-2',
                      index === group.tickets.length - 1 && 'border-b-border/70',
                    )}
                    data-testid="cobranza-client-ticket"
                  >
                    <TableCell />
                    <TableCell>
                      <p className="truncate pl-2">
                        <Link
                          href={`/tickets/${ticketRow.id}`}
                          className="font-mono font-medium tabular-nums text-primary underline-offset-4 hover:underline"
                        >
                          {ticketRow.folio}
                        </Link>{' '}
                        <span className="text-muted-foreground">
                          · <ListShortDate date={ticketRow.ticket_date ?? ticketRow.created_at} />
                          {ticketRow.services_summary ? ` · ${ticketRow.services_summary}` : ''}
                        </span>
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {TICKET_PAYMENT_STATUS_LABEL[ticketRow.paymentStatus]}
                    </TableCell>
                    <TableCell
                      className={cn('tabular-nums', cobranzaDaysClassName(ticketRow.daysOutstanding))}
                    >
                      {plural(ticketRow.daysOutstanding, 'día', 'días')}
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground xl:table-cell">
                      {(ticketRow.paid ?? 0) > 0.01
                        ? `${formatTicketListAmount(ticketRow.paid)} de ${formatTicketListAmount(ticketRow.total)}`
                        : 'sin pagos'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <FormattedCurrency amount={ticketRow.balanceDue} />
                    </TableCell>
                    <TableCell>
                      <CobranzaRowActions
                        row={ticketRow}
                        canWrite={canWrite}
                        companyId={companyId}
                        companyName={companyName}
                        onCollect={onCollect}
                      />
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </React.Fragment>
        );
      }}
    />
  );
};
