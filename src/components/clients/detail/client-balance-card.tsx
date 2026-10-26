import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ClientStatementButton } from '@/components/clients/detail/client-statement-button';
import { MoneyFigure } from '@/components/documents/money-figure';
import type { ClientDetailTicket } from '@/actions/client-detail';
import type { ClientBalanceSummary } from '@/lib/client-detail';

type ClientBalanceCardProps = {
  clientId: number;
  balance: ClientBalanceSummary;
  /** For the estado de cuenta: the finished tickets that still owe (ZIG-I31-3). */
  clientName?: string;
  phone?: string | null;
  tickets?: ClientDetailTicket[];
};

/** Saldo del cliente: unpaid amounts on finished tickets, with a way into cobranza (ZIG-I17-2). */
export const ClientBalanceCard = ({
  clientId,
  balance,
  clientName = '',
  phone = null,
  tickets = [],
}: ClientBalanceCardProps) => {
  const owes = balance.balanceDue > 0;
  const statementTickets = tickets
    .filter((row) => row.finished && row.balanceDue > 0)
    .map((row) => ({
      ticketId: row.id,
      folio: row.folio,
      date: row.ticketDate ?? row.createdAt,
      balanceDue: row.balanceDue,
    }));
  return (
    <section
      aria-label="Saldo del cliente"
      data-testid="client-balance"
      className="space-y-1 rounded-2xl border border-border/60 bg-card p-4"
    >
      <p className="text-caption text-muted-foreground">
        {owes ? 'Saldo por cobrar' : 'Sin saldo pendiente'}
      </p>
      <MoneyFigure
        amount={balance.balanceDue}
        size="hero"
        tone={owes ? 'default' : 'muted'}
        className="block font-bold leading-tight"
        data-testid="client-balance-amount"
      />
      {owes ? (
        <>
          <p className="text-caption text-muted-foreground" data-testid="client-balance-count">
            {balance.dueTicketCount === 1
              ? 'En 1 ticket terminado'
              : `En ${balance.dueTicketCount} tickets terminados`}
          </p>
          <Link
            href={`/cobranza?clientId=${clientId}`}
            className="inline-flex min-h-11 items-center gap-1.5 pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            data-testid="client-balance-cobranza-link"
          >
            Ver en cobranza
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {/* A sibling, hidden below md, so the phone card keeps its layout. */}
          <ClientStatementButton
            clientName={clientName}
            phone={phone}
            tickets={statementTickets}
            total={balance.balanceDue}
          />
        </>
      ) : null}
    </section>
  );
};
