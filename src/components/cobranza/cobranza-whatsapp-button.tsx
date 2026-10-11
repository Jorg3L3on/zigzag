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
  /** `card`: full-width labelled button for the phone card (ZIG-I18-2). */
  variant?: 'icon' | 'card';
};

export const CobranzaWhatsAppButton = ({
  row,
  companyName,
  variant = 'icon',
}: CobranzaWhatsAppButtonProps) => {
  const share = buildWhatsAppBalanceShare({
    phone: row.client_tel,
    clientName: row.client_name,
    ticketId: row.id,
    balanceDue: row.balanceDue,
    companyName,
  });

  if (variant === 'card') {
    if (!share) {
      return (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl text-base"
          disabled
          aria-label={`Sin teléfono para recordar el ticket ${row.id}`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          Sin teléfono
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2 rounded-xl text-base"
        asChild
      >
        <a
          href={share.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Recordar por WhatsApp el ticket ${row.id}`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          Recordar por WhatsApp
        </a>
      </Button>
    );
  }

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
