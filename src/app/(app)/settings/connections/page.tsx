import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { lastWhoamiByClient } from '@/lib/mcp/client-whoami';
import { listSelectableCompaniesForUser } from '@/lib/mcp/domain';
import { getMcpResourceUrl } from '@/lib/server/mcp-oauth/config';
import { ConnectionsPanel } from '@/components/settings/ConnectionsPanel';

export default async function SettingsConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = BigInt(session.user.id);
  const [companies, whoami] = await Promise.all([
    listSelectableCompaniesForUser(userId),
    lastWhoamiByClient(userId),
  ]);

  return (
    <ConnectionsPanel
      mcpUrl={getMcpResourceUrl()}
      companies={companies}
      whoami={whoami}
    />
  );
}
