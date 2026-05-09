'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getTickets } from '@/actions/tickets';
import { FormattedDate } from '@/components/formatted-date';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  TicketRowActions,
  TicketDownloadButton,
} from '@/components/tickets/ticket-row-actions';
import { useCompany } from '@/contexts/company-context';
import { Input } from '@/components/ui/input';
import { TripledEmptyState } from '@/components/tripled';
import { Search, Ticket as TicketIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

interface Ticket {
  id: bigint;
  client_name: string | null;
  client_tel: string | null;
  ticket_date: Date | null;
  total: number | null;
  document: string | null;
}

export default function TicketsList() {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');

  const fetchTickets = React.useCallback(async () => {
    if (!selectedCompany?.id) return;

    try {
      const result = await getTickets(selectedCompany.id);
      if (result.success && result.data) {
        setTickets(result.data);
        setLoadError(null);
      } else if (!result.success) {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los tickets',
          ),
        );
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(errorType, 'No se pudieron cargar los tickets'),
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id]);

  React.useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDelete = (id: number) => {
    setTickets((prevTickets) =>
      prevTickets.filter((ticket) => Number(ticket.id) !== id),
    );
  };

  if (loading) {
    return <div>Cargando tickets...</div>;
  }

  const filteredTickets = tickets.filter((ticket) => {
    const search = searchValue.toLowerCase();
    return (
      ticket.id.toString().includes(search) ||
      (ticket.client_name ?? '').toLowerCase().includes(search) ||
      (ticket.client_tel ?? '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Buscar por ID, cliente o teléfono..."
        />
      </div>

      {loadError ? (
        <div className="space-y-4">
          <TripledEmptyState
            icon={<TicketIcon className="h-4 w-4" />}
            title="Error de carga"
            description={loadError}
          />
          <div className="flex justify-center">
            <Button variant="outline" onClick={fetchTickets}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <TripledEmptyState
          icon={<TicketIcon className="h-4 w-4" />}
          title="Sin tickets"
          description="No hay tickets que coincidan con la búsqueda."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id.toString()}
                className="cursor-pointer rounded-md border p-4"
                tabIndex={0}
                role="button"
                aria-label={`Editar ticket ${ticket.id.toString()}`}
                onClick={() => router.push(`/dashboard/tickets/${ticket.id}/edit`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(`/dashboard/tickets/${ticket.id}/edit`);
                  }
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ticket</p>
                    <p className="text-sm font-semibold">#{ticket.id.toString()}</p>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TicketDownloadButton document={ticket.document} />
                    <TicketRowActions ticket={ticket} onDelete={handleDelete} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium">{ticket.client_name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p>{ticket.client_tel || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p>
                      <FormattedDate date={ticket.ticket_date} />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-medium">
                      <FormattedCurrency amount={ticket.total} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-[50px]">PDF</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id.toString()}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}/edit`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/dashboard/tickets/${ticket.id}/edit`);
                      }
                    }}
                  >
                    <TableCell>{ticket.id}</TableCell>
                    <TableCell>{ticket.client_name}</TableCell>
                    <TableCell>
                      <div onClick={(event) => event.stopPropagation()}>
                        <TicketDownloadButton document={ticket.document} />
                      </div>
                    </TableCell>
                    <TableCell>{ticket.client_tel}</TableCell>
                    <TableCell>
                      <FormattedDate date={ticket.ticket_date} />
                    </TableCell>
                    <TableCell>
                      <FormattedCurrency amount={ticket.total} />
                    </TableCell>
                    <TableCell>
                      <div onClick={(event) => event.stopPropagation()}>
                        <TicketRowActions ticket={ticket} onDelete={handleDelete} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
