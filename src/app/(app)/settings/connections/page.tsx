import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listSelectableCompaniesForUser } from '@/lib/mcp/domain';
import { getMcpResourceUrl } from '@/lib/server/mcp-oauth/config';
import { ConnectionsPanel } from '@/components/settings/ConnectionsPanel';

export default async function SettingsConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const companies = await listSelectableCompaniesForUser(BigInt(session.user.id));

  return (
    <ConnectionsPanel
      mcpUrl={getMcpResourceUrl()}
      companies={companies}
    />
  );
}
