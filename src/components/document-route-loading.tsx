'use client';

import { usePathname } from 'next/navigation';
import { FileText, Ticket } from 'lucide-react';

import {
  DocumentComposerRouteLoading,
  DocumentDetailRouteLoading,
  DocumentListRouteLoading,
} from '@/components/route-loading-skeletons';
import { TicketsListSkeleton } from '@/components/tickets/tickets-list-skeleton';

type DocumentSection = 'tickets' | 'presupuestos';

const SECTIONS = {
  tickets: {
    title: 'Tickets',
    description: 'Lista de todos los tickets registrados',
    icon: <Ticket className="size-5" aria-hidden />,
    breadcrumbs: [{ label: 'Tickets' }],
    listLabel: 'Cargando tabla de tickets',
    detailLabel: 'Cargando ticket',
    detailCrumb: 'Ticket',
    composerLabel: 'Cargando ticket',
  },
  presupuestos: {
    title: 'Presupuestos',
    description: 'Cola comercial de presupuestos',
    icon: <FileText className="size-5" aria-hidden />,
    breadcrumbs: [{ label: 'Hoy', href: '/dashboard' }, { label: 'Presupuestos' }],
    listLabel: 'Cargando presupuestos',
    detailLabel: 'Cargando presupuesto',
    detailCrumb: 'Presupuesto',
    composerLabel: 'Cargando presupuesto',
  },
} as const;

/**
 * The section's loading.tsx also covers its child routes: without a prefetch (always
 * in dev) Next shows the parent's loading while a ticket opens. So the skeleton
 * follows the URL, never the list's for a ticket (ZIG-28).
 */
export const DocumentRouteLoading = ({ section }: { section: DocumentSection }) => {
  const pathname = usePathname() ?? '';
  const config = SECTIONS[section];
  const rest = pathname.replace(new RegExp(`^/${section}/?`), '');

  if (rest === 'create' || rest.endsWith('/edit')) {
    return <DocumentComposerRouteLoading label={config.composerLabel} />;
  }
  if (rest) {
    return (
      <DocumentDetailRouteLoading
        breadcrumbs={[{ label: config.title, href: `/${section}` }, { label: config.detailCrumb }]}
        label={config.detailLabel}
      />
    );
  }
  return (
    <DocumentListRouteLoading
      title={config.title}
      description={config.description}
      icon={config.icon}
      breadcrumbs={[...config.breadcrumbs]}
    >
      <TicketsListSkeleton label={config.listLabel} />
    </DocumentListRouteLoading>
  );
};
