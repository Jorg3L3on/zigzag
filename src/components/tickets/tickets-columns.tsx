'use client';

import { formatDocumentFolio } from '@/lib/folio';
import type { Ticket } from '@/actions/tickets';
import type { ColumnDef } from '@tanstack/react-table';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  type ListStatusTone,
} from '@/components/list-page';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TicketRowMenu } from '@/components/tickets/ticket-row-actions';
import { hrefForTicketListRow } from '@/lib/ticket-list-navigation';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  getTicketPaymentStatusSortRank,
} from '@/lib/ticket-payment-status';
import { formatPhoneDisplay } from '@/lib/phone-links';

export type TicketListEstadoLabel = 'Pagado' | 'Pago parcial' | 'Pendiente' | 'En proceso';

/**
 * One-line estado. A ticket still in progress is En proceso when it would
 * otherwise read Pendiente (ZIG-I28-4).
 */
const PAYMENT_ESTADO_LABEL: Record<
  ReturnType<typeof getTicketPaymentStatus>,
  TicketListEstadoLabel
> = {
  paid: 'Pagado',
  partial: 'Pago parcial',
  pending: 'Pendiente',
};

export const ticketListEstadoLabel = (
  ticket: Pick<Ticket, 'finished' | 'total' | 'paid'>,
): TicketListEstadoLabel => {
  // Unfinished work reads En proceso whatever was paid in advance, like the detail pill.
  if (!ticket.finished) {
    return 'En proceso';
  }
  return PAYMENT_ESTADO_LABEL[getTicketPaymentStatus(ticket.total, ticket.paid)];
};

/**
 * ZIG-I33 §6 tones: paid emerald, money still owed amber (the Por cobrar view's dot),
 * work in progress slate.
 */
const ESTADO_TONE: Record<TicketListEstadoLabel, ListStatusTone> = {
  Pagado: 'emerald',
  'Pago parcial': 'amber',
  Pendiente: 'amber',
  'En proceso': 'slate',
};

/** Em dash when the ticket is still En proceso or the saldo is already 0. */
const TicketListSaldo = ({ ticket }: { ticket: Ticket }) => {
  const balance = getTicketBalanceDue(ticket.total, ticket.paid);
  if (!ticket.finished || balance <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="font-semibold tabular-nums">
      <FormattedCurrency amount={balance} />
    </span>
  );
};

export type TicketsColumnsOptions = {
  onDelete: (id: number) => void;
  onDeleteFailed?: (id: number) => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  canWrite?: boolean;
  companyId?: number | null;
};

/**
 * The desktop tickets table (ZIG-I33-2). Sorting is manual: the header asks the
 * server (`getTicketsPaginated({ sort })`), so the sorting functions are gone and
 * each column only says which way it sorts first.
 */
export const createTicketsColumns = ({
  onDelete,
  onDeleteFailed,
  onPaymentApplied,
  canWrite = true,
  companyId,
}: TicketsColumnsOptions): ColumnDef<Ticket>[] => [
  {
    id: 'id',
    accessorFn: (row) => Number(row.id),
    sortDescFirst: true,
    // Widths follow the list's container, not the viewport: the sidebar takes 256px, and
    // unsized columns split the row evenly (Cliente was ~110px at 1280, PR #610 review).
    meta: { className: 'w-[6rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Folio" />,
    cell: ({ row }) => (
      <span className="font-mono text-caption tabular-nums">
        {formatDocumentFolio(row.original)}
      </span>
    ),
  },
  {
    id: 'client_name',
    accessorKey: 'client_name',
    sortDescFirst: false,
    // Takes what is left (about 330px at 1280 with the sidebar) until Trabajo shows; then
    // 21rem, as wide as at 1280: client names win over Trabajo, as on the presupuestos table.
    meta: { className: '@min-[75rem]:w-[21rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Cliente" />,
    cell: ({ row }) => {
      const name = row.original.client_name?.trim() || '—';
      const phone = row.original.client_tel?.trim();
      return (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5" title={name}>
            {name}
          </p>
          {phone ? (
            <p className="truncate text-caption leading-4 tabular-nums text-muted-foreground">
              {formatPhoneDisplay(phone) ?? phone}
            </p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'client_tel',
    accessorKey: 'client_tel',
    sortDescFirst: false,
    // Hidden: the number sits under the client. The column stays for the phone's Teléfono sort.
    meta: { className: 'hidden' },
    header: () => null,
    cell: () => null,
    enableHiding: true,
  },
  {
    id: 'services',
    accessorFn: (row) => row.services_summary ?? '',
    enableSorting: false,
    // Only once Cliente keeps 21rem and Trabajo gets the canvas's 220px (75rem list, ~1504 with the sidebar).
    meta: { className: 'hidden @min-[75rem]:table-cell' },
    header: () => <span>Trabajo</span>,
    cell: ({ row }) => {
      const summary = row.original.services_summary?.trim();
      if (!summary) {
        return <span className="text-muted-foreground">Sin servicios todavía</span>;
      }
      // «A, B… +5»: the first two names, then how many more (canvas ListaA).
      const head = row.original.services_head?.length ? row.original.services_head.join(', ') : summary;
      const more = Math.max((row.original.services_count ?? 0) - 2, 0);
      return (
        <span className="flex min-w-0 items-baseline gap-1 text-slate-600 md:text-[13px] dark:text-slate-300" title={summary}>
          <span className="truncate">{head}</span>
          {more > 0 ? <span className="shrink-0 text-muted-foreground/70">+{more}</span> : null}
        </span>
      );
    },
  },
  {
    id: 'ticket_date',
    accessorFn: (row) => row.ticket_date,
    sortDescFirst: true,
    meta: { className: 'hidden w-[6.5rem] @min-[48rem]:table-cell' },
    header: ({ column }) => <ListSortableHeader column={column} label="Fecha" />,
    cell: ({ row }) => <ListShortDate date={row.original.ticket_date} />,
  },
  {
    id: 'total',
    accessorFn: (row) => row.total,
    sortDescFirst: true,
    meta: { className: 'w-[8.5rem]', align: 'right' },
    header: ({ column }) => <ListSortableHeader column={column} label="Total" align="right" />,
    cell: ({ row }) => (
      <span className="font-medium">
        <FormattedCurrency amount={row.original.total} />
      </span>
    ),
  },
  {
    id: 'balance',
    accessorFn: (row) => getTicketBalanceDue(row.total, row.paid),
    sortDescFirst: true,
    meta: { className: 'w-[8.5rem]', align: 'right' },
    header: ({ column }) => <ListSortableHeader column={column} label="Saldo" align="right" />,
    cell: ({ row }) => <TicketListSaldo ticket={row.original} />,
  },
  {
    id: 'paymentRank',
    accessorFn: (row) => getTicketPaymentStatusSortRank(row.total, row.paid),
    sortDescFirst: false,
    meta: { className: 'w-[7.5rem]' },
    header: ({ column }) => <ListSortableHeader column={column} label="Estado" />,
    cell: ({ row }) => {
      const label = ticketListEstadoLabel(row.original);
      return (
        <ListStatusPill tone={ESTADO_TONE[label]}>
          <span data-testid="ticket-list-estado">{label}</span>
        </ListStatusPill>
      );
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    // Only ⋯ (ListRowMenu): no buttons on hover; Terminar, Cobrar and the PDF live in it (ZIG-33).
    meta: { className: 'w-12' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      // The Cobrar and Eliminar dialogs are portals, but React bubbles their clicks
      // through this cell: stop them here so they never open the row.
      <div
        className="flex justify-end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TicketRowMenu
          ticket={row.original}
          onDelete={onDelete}
          onDeleteFailed={onDeleteFailed}
          onPaymentApplied={onPaymentApplied}
          canWrite={canWrite}
          companyId={companyId}
          finishHref={
            row.original.services_summary?.trim()
              ? hrefForTicketListRow(row.original, canWrite)
              : undefined
          }
        />
      </div>
    ),
  },
];
