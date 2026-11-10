import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import {
  getMcpResourceUrl,
  getOAuthIssuer,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
  parseScopeParam,
} from '@/lib/server/mcp-oauth/config';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';
import { recordAgentAccessAudit } from '@/lib/server/agent-access-audit';

const consentFieldsSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().optional(),
  allow_write: z.enum(['true', 'false']).optional(),
  allow_payments: z.enum(['true', 'false']).optional(),
  allowed_company_ids: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => {
      const raw = Array.isArray(value) ? value : [value];
      const ids = raw
        .flatMap((entry) => entry.split(','))
        .map((entry) => Number(entry.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      return [...new Set(ids)];
    })
    .pipe(z.array(z.number().int().positive()).min(1)),
});

const parseConsentBody = async (
  request: NextRequest,
): Promise<{ fields: Record<string, string | string[]>; formPost: boolean }> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    const fields: Record<string, string | string[]> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') {
        if (key === 'allowed_company_ids') {
          const existing = fields[key];
          fields[key] = Array.isArray(existing)
            ? [...existing, value]
            : existing
              ? [existing, value]
              : [value];
        } else {
          fields[key] = value;
        }
      }
    }
    return { fields, formPost: true };
  }
  const json = (await request.json()) as Record<string, string | string[]>;
  return { fields: json, formPost: false };
};

const buildOAuthCallbackUrl = (input: {
  redirectUri: string;
  code: string;
  state?: string;
}): URL => {
  const redirect = new URL(input.redirectUri);
  redirect.searchParams.set('code', input.code);
  if (input.state) redirect.searchParams.set('state', input.state);
  return redirect;
};

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * Consent POST mints an authorization code, so it must come from our own
 * consent page: Origin equal to the issuer (or this request's origin), or,
 * without Origin, Sec-Fetch-Site same-origin. Anything else is a cross-site
 * post (CSRF) and gets 403.
 */
const isSameOriginRequest = (request: NextRequest): boolean => {
  const allowed = new Set(
    [originOf(getOAuthIssuer(request)), originOf(request.url)].filter(
      (value): value is string => value != null,
    ),
  );
  const origin = request.headers.get('origin');
  if (origin) return allowed.has(origin);
  return request.headers.get('sec-fetch-site') === 'same-origin';
};

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { fields, formPost } = await parseConsentBody(request);
    const input = consentFieldsSchema.parse(fields);
    const client = await resolveOAuthClient(input.client_id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 });
    }

    assertRedirectUriAllowed(client, input.redirect_uri);

    // Write is opt-in: granted only when the person ticked it (allow_write=true).
    let scopes = parseScopeParam(input.scope);
    if (input.allow_write !== 'true') {
      scopes = scopes.filter((scope) => scope !== 'write');
    }
    // Payments too (ZIG-I23-7): its own checkbox, never implied by write.
    if (input.allow_payments !== 'true') {
      scopes = scopes.filter((scope) => scope !== 'payments');
    }
    if (!scopes.includes('read')) scopes = ['read', ...scopes];

    // RFC 8707: absent resource means this MCP server; any other is rejected.
    const mcpResource = getMcpResourceUrl(request);
    if (input.resource && !mcpResourcesMatch(input.resource, mcpResource, request)) {
      return NextResponse.json(
        {
          error: 'invalid_target',
          error_description: 'resource debe ser la URL del servidor MCP de ZigZag',
        },
        { status: 400 },
      );
    }
    const resource = normalizeMcpResourceUrl(input.resource ?? mcpResource, request);

    const code = await createAuthorizationCode({
      clientId: input.client_id,
      userId: BigInt(session.user.id),
      redirectUri: input.redirect_uri,
      scopes,
      allowedCompanyIds: input.allowed_company_ids,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      resource,
      request,
    });

    await recordAgentAccessAudit({
      event: 'oauth.consent_granted',
      userId: BigInt(session.user.id),
      resourceId: input.client_id,
      payload: {
        client_name: client.client_name,
        redirect_host: new URL(input.redirect_uri).host,
        scopes,
        allowed_company_ids: input.allowed_company_ids,
      },
    });

    const redirect = buildOAuthCallbackUrl({
      redirectUri: input.redirect_uri,
      code,
      state: input.state,
    });

    if (formPost) {
      // 303 for non-JS form posts; production CSP form-action 'self' blocks
      // third-party Location targets anyway — the consent UI uses fetch + JS nav.
      return new Response(null, {
        status: 303,
        headers: { Location: redirect.toString() },
      });
    }

    return NextResponse.json({ redirect_to: redirect.toString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: error.issues },
        { status: 400 },
      );
    }
    // Never echo internal messages (database, etc.) to the browser.
    console.error('OAuth consent error:', error);
    return NextResponse.json(
      { error: 'No se pudo autorizar la conexión' },
      { status: 400 },
    );
  }
}
