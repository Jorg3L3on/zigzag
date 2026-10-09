'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { TicketComposer } from '@/components/tickets/composer/ticket-composer';

const CreateTicketPageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
    <span className="sr-only">Cargando nuevo ticket</span>
  </div>
);

/** Nuevo ticket: single-screen composer (ZIG-I2-4) replacing the 3-step wizard. */
export default function CreateTicketPage() {
  return (
    <React.Suspense fallback={<CreateTicketPageFallback />}>
      <TicketComposer />
    </React.Suspense>
  );
}
