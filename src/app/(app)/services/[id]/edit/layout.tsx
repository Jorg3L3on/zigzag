import type React from 'react';
import { requirePagePermission } from '@/lib/page-authz';

export default async function EditServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission('services.write');
  return children;
}
