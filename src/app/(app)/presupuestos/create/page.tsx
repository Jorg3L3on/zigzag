'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { PresupuestoComposer } from '@/components/presupuestos/presupuesto-composer';

const CreatePresupuestoPageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
    <span className="sr-only">Cargando nuevo presupuesto</span>
  </div>
);

/** Nuevo presupuesto: single-screen composer (ZIG-I5-3) replacing the old form. */
export default function CreatePresupuestoPage() {
  return (
    <React.Suspense fallback={<CreatePresupuestoPageFallback />}>
      <PresupuestoComposer />
    </React.Suspense>
  );
}
