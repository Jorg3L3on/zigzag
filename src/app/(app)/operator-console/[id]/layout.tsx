import { notFound } from 'next/navigation';
import { OperatorCompanyShell } from '@/components/operator-console/operator-company-shell';
import { requirePagePermission, requireSystemPage } from '@/lib/page-authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** The company page of the console (ZIG-I38-2): /operator-console/[id]/<tab>. */
export default async function OperatorCompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireSystemPage();
  await requirePagePermission('companies.read');
  const { id } = await params;
  const companyId = Number.parseInt(id, 10);
  if (!Number.isInteger(companyId) || companyId < 1 || String(companyId) !== id) {
    notFound();
  }
  return <OperatorCompanyShell companyId={companyId}>{children}</OperatorCompanyShell>;
}
