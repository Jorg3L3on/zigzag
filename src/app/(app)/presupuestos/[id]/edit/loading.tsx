import { DocumentComposerRouteLoading } from '@/components/route-loading-skeletons';

// The composer's own skeleton, not the list's or the receipt's (ZIG-28).
export default function Loading() {
  return <DocumentComposerRouteLoading label="Cargando editor del presupuesto" />;
}
