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

  React.useEffect(() => {
    const fetchTickets = async () => {
      const result = await getTickets(selectedCompany?.id ?? null);
      if (result.success && Array.isArray(result.data)) {
        setTickets(result.data);
      } else {
        setTickets([]);
      }
    };

    fetchTickets();
  }, [selectedCompany]);

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
                  <TicketRowActions ticket={ticket} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
