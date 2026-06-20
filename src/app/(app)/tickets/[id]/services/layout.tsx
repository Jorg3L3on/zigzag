import type React from 'react';
import { requirePagePermission } from '@/lib/page-authz';

export default async function TicketServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission('tickets.write');
  return children;
}
