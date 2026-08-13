import type { ReactNode } from 'react';
import { requirePagePermission } from '@/lib/page-authz';

export default async function CreatePresupuestoLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission('tickets.write');
  return children;
}
