'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormattedCurrency } from '@/components/formatted-currency';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import type { DashboardRecentTicket } from '@/actions/dashboard';

export type DashboardRecentTicketsProps = {
  tickets: DashboardRecentTicket[];
};

const formatTicketDate = (ticket: DashboardRecentTicket): string => {
  const ref = ticket.ticketDate
    ? new Date(ticket.ticketDate)
    : new Date(ticket.createdAt);
  return format(ref, 'EEE, d MMMM yyyy', { locale: es });
};

export const DashboardRecentTickets = ({
  tickets,
}: DashboardRecentTicketsProps) => {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return tickets;
    }
    return tickets.filter((row) =>
      row.clientName.toLowerCase().includes(normalized),
    );
  }, [query, tickets]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <Card id="dashboard-recent-tickets">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>
            Últimos tickets de la empresa, ordenados del más reciente
          </CardDescription>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder="Buscar por cliente"
            className="min-h-11 pl-9 sm:min-h-9"
            aria-label="Buscar tickets por nombre de cliente"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">
            {tickets.length === 0
              ? 'No hay tickets para mostrar.'
              : 'Ningún ticket coincide con la búsqueda.'}
          </p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {filtered.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        <Link
                          href={`/dashboard/tickets/${row.id}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {row.clientName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTicketDate(row)}
                      </p>
                    </div>
                    <TicketPaymentBadge total={row.total} paid={row.paid} />
                  </div>
                  <p className="mt-3 text-lg font-semibold tabular-nums">
                    <FormattedCurrency amount={row.total ?? 0} />
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/tickets/${row.id}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {row.clientName}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <FormattedCurrency amount={row.total ?? 0} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTicketDate(row)}
                      </TableCell>
                      <TableCell>
                        <TicketPaymentBadge
                          total={row.total}
                          paid={row.paid}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
