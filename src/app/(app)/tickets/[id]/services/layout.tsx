import type React from 'react';
import { requirePagePermission } from '@/lib/page-authz';
import { redirectPresupuestoToOwnPage } from '@/lib/presupuesto-route-guard';

export default async function TicketServicesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('tickets.write');
  await redirectPresupuestoToOwnPage((await params).id);
  return children;
}
