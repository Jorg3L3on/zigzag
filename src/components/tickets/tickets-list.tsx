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
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchTickets = React.useCallback(async () => {
    if (!selectedCompany?.id) return;

    try {
      const result = await getTickets(selectedCompany.id);
      if (result.success && result.data) {
        setTickets(result.data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
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

  return (
    <div className="rounded-md border">
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
          {tickets?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No hay tickets registrados
              </TableCell>
            </TableRow>
          ) : (
            tickets?.map((ticket) => (
              <TableRow key={ticket.id.toString()}>
                <TableCell>{ticket.id}</TableCell>
                <TableCell>{ticket.client_name}</TableCell>
                <TableCell>
                  <TicketDownloadButton document={ticket.document} />
                </TableCell>
                <TableCell>{ticket.client_tel}</TableCell>
                <TableCell>
                  <FormattedDate date={ticket.ticket_date} />
                </TableCell>
                <TableCell>
                  <FormattedCurrency amount={ticket.total} />
                </TableCell>
                <TableCell>
                  <TicketRowActions ticket={ticket} onDelete={handleDelete} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
