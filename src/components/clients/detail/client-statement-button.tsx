'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/company-context';
import { useCompanyPaymentInfo } from '@/hooks/use-company-payment-info';
import {
  buildWhatsAppStatementShare,
  type WhatsAppStatementTicket,
} from '@/lib/whatsapp-share';

type ClientStatementButtonProps = {
  clientName: string;
  phone: string | null;
  tickets: WhatsAppStatementTicket[];
  total: number;
};

/**
 * «Estado de cuenta»: the same WhatsApp as Cobranza › Por cliente (ZIG-I31-3).
 * Desktop only; nothing renders without a phone.
 */
export const ClientStatementButton = ({
  clientName,
  phone,
  tickets,
  total,
}: ClientStatementButtonProps) => {
  const { selectedCompany } = useCompany();
  const payment = useCompanyPaymentInfo();
  const share = buildWhatsAppStatementShare({
    phone,
    clientName,
    tickets,
    total,
    companyName: selectedCompany?.name ?? null,
    payment,
  });
  if (!share) return null;
  return (
    <Button asChild variant="outline" size="sm" className="hidden md:mt-1 md:flex md:w-fit">
      <a
        href={share.href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="client-balance-statement"
      >
        <MessageCircle className="h-4 w-4" aria-hidden data-icon="inline-start" />
        Estado de cuenta por WhatsApp
      </a>
    </Button>
  );
};
