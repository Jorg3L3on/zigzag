'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { TicketListCollectPaymentDialog } from '@/components/tickets/ticket-list-collect-payment-dialog';

type CollectContextValue = { openCollect: () => void };

const CollectContext = React.createContext<CollectContextValue | null>(null);

type TicketCollectProviderProps = {
  ticketId: number;
  total: number | null;
  paid: number | null;
  companyId: number | null;
  children: React.ReactNode;
};

/**
 * One Registrar pago sheet for the whole detail page (ZIG-I13-4): the Cobrar
 * quick action, the sticky Registrar pago and the desktop button all open it.
 */
export const TicketCollectProvider = ({
  ticketId,
  total,
  paid,
  companyId,
  children,
}: TicketCollectProviderProps) => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ openCollect: () => setOpen(true) }), []);

  return (
    <CollectContext.Provider value={value}>
      {children}
      <TicketListCollectPaymentDialog
        open={open}
        onOpenChange={setOpen}
        ticketId={ticketId}
        total={total}
        paid={paid}
        companyId={companyId}
        onPaymentApplied={() => router.refresh()}
      />
    </CollectContext.Provider>
  );
};

/** Null outside the provider (e.g. an unfinished ticket has nothing to collect). */
export const useTicketCollect = (): CollectContextValue | null =>
  React.useContext(CollectContext);
