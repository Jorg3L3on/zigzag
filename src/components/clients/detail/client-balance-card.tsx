import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ClientStatementButton } from '@/components/clients/detail/client-statement-button';
import { MoneyFigure } from '@/components/documents/money-figure';
import type { ClientDetailTicket } from '@/actions/client-detail';
import type { ClientBalanceSummary } from '@/lib/client-detail';
import { cn } from '@/lib/utils';

type ClientBalanceCardProps = {
  clientId: number;
  balance: ClientBalanceSummary;
  /** For the estado de cuenta: the finished tickets that still owe (ZIG-I31-3). */
  clientName?: string;
  phone?: string | null;
  tickets?: ClientDetailTicket[];
  className?: string;
};

/** Saldo del cliente: unpaid amounts on finished tickets, with a way into cobranza (ZIG-I17-2). */
export const ClientBalanceCard = ({
  clientId,
  balance,
  clientName = '',
  phone = null,
  tickets = [],
  className,
}: ClientBalanceCardProps) => {
  const owes = balance.balanceDue > 0;
  // Oldest work first, the same order as Cobranza › Por cliente.
  const statementTickets = tickets
    .filter((row) => row.finished && row.balanceDue > 0)
    .sort(
      (a, b) =>
        new Date(a.ticketDate ?? a.createdAt).getTime() -
          new Date(b.ticketDate ?? b.createdAt).getTime() || Number(a.id) - Number(b.id),
    )
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
      // From lg: the Saldo card of the ticket detail rail (label, 30 px figure).
      className={cn(
        'space-y-1 rounded-2xl border border-border/60 bg-card p-4 lg:rounded-xl lg:border-border/50 lg:p-5',
        className,
      )}
    >
      <p className="text-caption text-muted-foreground lg:text-[11px] lg:font-semibold lg:uppercase lg:tracking-[0.08em]">
        {owes ? 'Saldo por cobrar' : 'Sin saldo pendiente'}
      </p>
      <MoneyFigure
        amount={balance.balanceDue}
        size="hero"
        tone={owes ? 'default' : 'muted'}
        className="block font-bold leading-tight lg:pt-0.5 lg:text-[30px] lg:leading-[1.1] lg:tracking-tight"
        data-testid="client-balance-amount"
      />
      {owes ? (
        <>
          <p className="text-caption text-muted-foreground" data-testid="client-balance-count">
            {balance.dueTicketCount === 1
              ? 'En 1 ticket terminado'
              : `En ${balance.dueTicketCount} tickets terminados`}
          </p>
          {/* One last child (display: contents): space-y gives every other child a bottom margin,
              so the phone card keeps its height with the md-only statement button inside. */}
          <div className="contents">
            <Link
              href={`/cobranza?clientId=${clientId}`}
              className="inline-flex min-h-11 items-center gap-1.5 pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              data-testid="client-balance-cobranza-link"
            >
              Ver en cobranza
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <ClientStatementButton
              clientName={clientName}
              phone={phone}
              tickets={statementTickets}
              total={balance.balanceDue}
            />
          </div>
        </>
      ) : null}
    </section>
  );
};
