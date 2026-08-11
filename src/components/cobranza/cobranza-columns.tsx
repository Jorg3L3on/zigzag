'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { CobranzaRow } from '@/lib/cobranza';
import { COBRANZA_AGING_LABEL } from '@/lib/cobranza';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import { TicketListPaymentSummary } from '@/components/tickets/ticket-list-payment-summary';

export const createCobranzaColumns = (): ColumnDef<CobranzaRow>[] => [
  {
    id: 'id',
    accessorFn: (row) => Number(row.id),
    header: 'ID',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.id}</span>
    ),
  },
  {
    id: 'client_name',
    accessorKey: 'client_name',
    header: 'Cliente',
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.client_name ?? 'Sin cliente'}
      </span>
    ),
  },
  {
    id: 'ticket_date',
    accessorFn: (row) =>
      new Date(row.ticket_date ?? row.created_at).getTime(),
    header: 'Fecha',
    cell: ({ row }) => (
      <FormattedDate
        date={new Date(row.original.ticket_date ?? row.original.created_at)}
      />
    ),
  },
  {
    id: 'payment',
    accessorFn: (row) => row.balanceDue,
    header: 'Cobro',
    cell: ({ row }) => (
      <TicketListPaymentSummary
        total={row.original.total}
        paid={row.original.paid}
      />
    ),
  },
  {
    id: 'balanceDue',
    accessorKey: 'balanceDue',
    header: 'Saldo',
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums text-amber-800 dark:text-amber-300">
        <FormattedCurrency amount={row.original.balanceDue} />
      </span>
    ),
  },
  {
    id: 'daysOutstanding',
    accessorKey: 'daysOutstanding',
    header: 'Antigüedad',
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="tabular-nums">
          {row.original.daysOutstanding}{' '}
          {row.original.daysOutstanding === 1 ? 'día' : 'días'}
        </span>
        <span className="text-xs text-muted-foreground">
          {COBRANZA_AGING_LABEL[row.original.agingBucket]}
        </span>
      </div>
    ),
  },
];
