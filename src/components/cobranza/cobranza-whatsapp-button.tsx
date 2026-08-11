'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CobranzaRow } from '@/lib/cobranza';
import { buildWhatsAppBalanceShare } from '@/lib/whatsapp-share';

type CobranzaWhatsAppButtonProps = {
  row: CobranzaRow;
  companyName?: string | null;
};

export const CobranzaWhatsAppButton = ({
  row,
  companyName,
}: CobranzaWhatsAppButtonProps) => {
  const share = buildWhatsAppBalanceShare({
    phone: row.client_tel,
    clientName: row.client_name,
    ticketId: row.id,
    balanceDue: row.balanceDue,
    companyName,
  });

  if (!share) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                aria-label={`WhatsApp no disponible para ticket ${row.id}`}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Agrega un teléfono válido en el ticket para compartir por WhatsApp
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      asChild
      aria-label={`Compartir saldo del ticket ${row.id} por WhatsApp`}
    >
      <a href={share.href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" aria-hidden />
      </a>
    </Button>
  );
};
