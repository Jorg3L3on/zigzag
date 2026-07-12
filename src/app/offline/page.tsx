import Link from 'next/link';
import { WifiOff } from 'lucide-react';

/**
 * Precached offline shell fallback. Shown when a document navigation fails
 * while offline. Does not claim offline data sync — Ticket/Client/Service
 * data still requires a live connection.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-background via-background to-muted/40 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <WifiOff className="h-10 w-10 text-amber-700" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">ZigZag</h1>
        <p className="text-muted-foreground">
          Sin conexión a internet. La interfaz puede cargarse desde la caché
          local, pero los tickets, clientes y servicios requieren red para
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
