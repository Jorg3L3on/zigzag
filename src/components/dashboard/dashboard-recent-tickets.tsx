'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Ticket } from 'lucide-react';
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
import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { cn } from '@/lib/utils';

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
    <Card
      id="dashboard-recent-tickets"
      className={cn(DASHBOARD_CARD_CLASS, 'flex h-full flex-col')}
    >
      <CardHeader className="gap-3 space-y-0 p-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Actividad reciente
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
              asChild
            >
              <Link href="/tickets">Ver todos</Link>
            </Button>
          </div>
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
            className="min-h-11 pl-9 shadow-none sm:min-h-9"
            aria-label="Buscar tickets por nombre de cliente"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
        {filtered.length === 0 ? (
          <TripledEmptyState
            icon={<Ticket className="h-4 w-4" />}
            title={tickets.length === 0 ? 'Sin actividad' : 'Sin resultados'}
            description={
              tickets.length === 0
                ? 'No hay tickets recientes para mostrar.'
                : 'Ningún ticket coincide con la búsqueda.'
            }
            action={
              tickets.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery('')}
                >
                  Limpiar búsqueda
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border/40 md:hidden">
              {filtered.map((row) => (
                <article key={row.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        <Link
                          href={`/tickets/${row.id}`}
                          className="text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  <p className="mt-2 text-base font-semibold tabular-nums">
                    <FormattedCurrency amount={row.total ?? 0} />
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                      Cliente
                    </TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                      Fecha
                    </TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                      Estado
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/40 hover:bg-muted/30"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/tickets/${row.id}`}
                          className="text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
