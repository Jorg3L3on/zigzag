import { redirect } from 'next/navigation';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';
import { auth } from '@/lib/auth';
import { listSelectableCompaniesForUser } from '@/lib/mcp/domain';
import { resolveOAuthClient } from '@/lib/server/mcp-oauth/clients';
import { getMcpResourceUrl, normalizeMcpResourceUrl } from '@/lib/server/mcp-oauth/config';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const params = await searchParams;
  const clientId = String(params.client_id ?? '');
  const redirectUri = String(params.redirect_uri ?? '');
  const codeChallenge = String(params.code_challenge ?? '');
  const codeChallengeMethod = String(params.code_challenge_method ?? '');

  if (!clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== 'S256') {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-sm text-muted-foreground">
        Solicitud OAuth incompleta o inválida.
      </div>
    );
  }

  const client = await resolveOAuthClient(clientId);
  if (!client) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-sm text-muted-foreground">
        Cliente OAuth desconocido.
      </div>
    );
  }

  const companies = await listSelectableCompaniesForUser(BigInt(session.user.id));
  const resource = normalizeMcpResourceUrl(
    String(params.resource ?? getMcpResourceUrl()),
  );

  return (
    <OAuthConsentForm
      clientName={client.client_name}
      clientUri={client.client_uri}
      requestedScope={String(params.scope ?? 'read')}
      companies={companies}
      consentParams={{
        client_id: clientId,
        redirect_uri: redirectUri,
        state: params.state ? String(params.state) : undefined,
        scope: params.scope ? String(params.scope) : undefined,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        resource,
      }}
    />
  );
}
