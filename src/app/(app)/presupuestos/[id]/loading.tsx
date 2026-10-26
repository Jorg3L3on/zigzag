import { DocumentDetailRouteLoading } from '@/components/route-loading-skeletons';

// Its own skeleton, so opening a presupuesto never shows the list's (ZIG-28).
export default function Loading() {
  return (
    <DocumentDetailRouteLoading
      breadcrumbs={[{ label: 'Presupuestos', href: '/presupuestos' }, { label: 'Presupuesto' }]}
      label="Cargando presupuesto"
    />
  );
}
