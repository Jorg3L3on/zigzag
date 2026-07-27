import type React from 'react';
import { requirePagePermission } from '@/lib/page-authz';

export default async function ServicesImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission('services.write');
  return children;
}
