import Link from 'next/link';
import { ClipboardList, FilePlus2, WifiOff } from 'lucide-react';

import { ZigZagMark } from '@/components/brand/zigzag-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Precached offline shell fallback. Shown when a document navigation fails
 * while offline. A ticket can still be written and kept on the phone (the
 * composer opens from its cached copy); the list of what is waiting to upload
 * is one tap away (ZIG-I36-15).
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-background via-background to-muted/40 p-6 text-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <ZigZagMark size={48} />
        <h1 className="text-2xl font-semibold tracking-tight">ZigZag</h1>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Sin conexión a internet
        </p>
        <p className="text-muted-foreground">
          Puedes seguir trabajando: lo que guardes se queda en este teléfono y se sube solo cuando
          haya señal.
        </p>
        <div className="mt-2 flex w-full flex-col gap-3">
          <Link
            href="/tickets/create"
            className={cn(buttonVariants({ size: 'lg' }), 'min-h-14 w-full gap-2 rounded-xl text-base')}
          >
            <FilePlus2 className="h-5 w-5" aria-hidden="true" />
            Nuevo ticket sin señal
          </Link>
          <Link
            href="/tickets?pendientes=1"
            className={cn(
              buttonVariants({ size: 'lg', variant: 'outline' }),
              'min-h-14 w-full gap-2 rounded-xl text-base',
            )}
          >
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            Ver pendientes
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Reintentar
        </Link>
      </div>
    </main>
  );
}
