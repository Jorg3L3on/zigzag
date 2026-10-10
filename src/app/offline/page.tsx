import Link from 'next/link';
import { WifiOff } from 'lucide-react';

import { ZigZagMark } from '@/components/brand/zigzag-mark';

/**
 * Precached offline shell fallback. Shown when a document navigation fails
 * while offline. Does not claim offline data sync — Ticket/Client/Service
 * data still requires a live connection.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-background via-background to-muted/40 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <ZigZagMark size={48} />
        <h1 className="text-2xl font-semibold tracking-tight">ZigZag</h1>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Sin conexión a internet
        </p>
        <p className="text-muted-foreground">
          La interfaz puede cargarse desde la caché local, pero los tickets, clientes y servicios requieren red para
          actualizarse o guardarse.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Reintentar al Dashboard
        </Link>
      </div>
    </main>
  );
}
