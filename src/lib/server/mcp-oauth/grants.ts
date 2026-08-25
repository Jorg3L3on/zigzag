import { eq } from 'drizzle-orm';
import {
  mcpOAuthAuthorizationCode,
  mcpOAuthGrant,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import type { AgentScope } from '@/lib/server/resolve-agent-context';
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_CODE_TTL_MS,
  OAUTH_TOKEN_LOOKUP_LENGTH,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';
import { tokenClientIdMatchesCode } from '@/lib/server/mcp-oauth/clients';
import { OAuthInvalidGrantError } from '@/lib/server/mcp-oauth/invalid-grant';
import {
  isOAuthExpiryPast,
  oauthExpiresAtFromNow,
} from '@/lib/server/mcp-oauth/oauth-expiry';
import {
  generateAuthorizationCode,
  generateOAuthAccessToken,
  generateOAuthRefreshToken,
  hashOAuthSecret,
  verifyOAuthSecret,
  verifyPkceS256,
} from '@/lib/server/mcp-oauth/tokens';
import { isValidPkceVerifier } from '@/lib/server/mcp-oauth/token-auth';

export const createAuthorizationCode = async (input: {
  clientId: string;
  userId: bigint;
  redirectUri: string;
  scopes: AgentScope[];
  allowedCompanyIds: number[];
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  request?: Request;
}) => {
  const { token: code, tokenHash } = generateAuthorizationCode();
  await db.insert(mcpOAuthAuthorizationCode).values({
    code_hash: tokenHash,
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    scopes: input.scopes,
    allowed_company_ids: input.allowedCompanyIds,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    resource: normalizeMcpResourceUrl(input.resource, input.request),
    expires_at: oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS),
  });
  return code;
};

export const peekAuthorizationCode = async (code: string) => {
  const codeHash = hashOAuthSecret(code);
  const row = await db.query.mcpOAuthAuthorizationCode.findFirst({
    where: eq(mcpOAuthAuthorizationCode.code_hash, codeHash),
    columns: {
      client_id: true,
      redirect_uri: true,
      used_at: true,
      expires_at: true,
    },
  });
  if (!row || row.used_at != null) return null;
  if (isOAuthExpiryPast(row.expires_at)) return null;
  return row;
};

export const exchangeAuthorizationCode = async (input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string | null;
  clientAuthenticatedViaPrivateKeyJwt?: boolean;
  resource?: string | null;
  request?: Request;
}) => {
  const codeHash = hashOAuthSecret(input.code);
  const row = await db.query.mcpOAuthAuthorizationCode.findFirst({
    where: eq(mcpOAuthAuthorizationCode.code_hash, codeHash),
  });

  if (!row || row.used_at != null) {
    throw new OAuthInvalidGrantError(row ? 'other' : 'not_found');
  }
  if (isOAuthExpiryPast(row.expires_at)) {
    throw new OAuthInvalidGrantError('expired');
  }
  if (row.redirect_uri !== input.redirectUri) {
    throw new OAuthInvalidGrantError('redirect');
  }
  const clientMatches = await tokenClientIdMatchesCode(
    input.clientId,
    row.client_id,
    row.redirect_uri,
  );
  if (!clientMatches) {
    throw new OAuthInvalidGrantError('client');
  }
  if (row.code_challenge_method !== 'S256') {
    throw new OAuthInvalidGrantError('pkce');
  }

  const pkceValid =
    isValidPkceVerifier(input.codeVerifier ?? undefined) &&
    verifyPkceS256(input.codeVerifier!, row.code_challenge);
  const jwtValid = input.clientAuthenticatedViaPrivateKeyJwt === true;

  if (!pkceValid && !jwtValid) {
    throw new OAuthInvalidGrantError('pkce');
  }

  if (
    input.resource &&
    !mcpResourcesMatch(input.resource, row.resource, input.request)
  ) {
    throw new OAuthInvalidGrantError('resource');
  }

  await db
    .update(mcpOAuthAuthorizationCode)
    .set({ used_at: new Date() })
    .where(eq(mcpOAuthAuthorizationCode.id, row.id));

  return issueGrant({
    userId: row.user_id,
    clientId: row.client_id,
    scopes: row.scopes.filter(
      (scope): scope is AgentScope => scope === 'read' || scope === 'write',
    ),
    allowedCompanyIds: row.allowed_company_ids,
    resource: normalizeMcpResourceUrl(row.resource, input.request),
  });
};

export const issueGrant = async (input: {
  userId: bigint;
  clientId: string;
  scopes: AgentScope[];
  allowedCompanyIds: number[];
  resource: string;
}) => {
  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  await db.insert(mcpOAuthGrant).values({
    user_id: input.userId,
    client_id: input.clientId,
    token_hash: access.tokenHash,
    token_prefix: access.tokenPrefix,
    refresh_token_hash: refresh.tokenHash,
    refresh_token_prefix: refresh.tokenPrefix,
    scopes: input.scopes,
    allowed_company_ids: input.allowedCompanyIds,
    resource: input.resource,
    expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS),
  });

  return {
    access_token: access.token,
    token_type: 'bearer' as const,
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.token,
    scope: input.scopes.join(' '),
  };
};

export const refreshOAuthGrant = async (input: {
  refreshToken: string;
  clientId: string;
  resource?: string | null;
  request?: Request;
}) => {
  const refreshHash = hashOAuthSecret(input.refreshToken);
  const row = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.refresh_token_hash, refreshHash),
  });

  if (!row || row.revoked_at != null) {
    throw new OAuthInvalidGrantError(row ? 'other' : 'not_found');
  }
  if (row.client_id !== input.clientId) {
    throw new OAuthInvalidGrantError('client');
  }
  if (
    input.resource &&
    !mcpResourcesMatch(input.resource, row.resource, input.request)
  ) {
    throw new OAuthInvalidGrantError('resource');
  }

  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  await db
    .update(mcpOAuthGrant)
    .set({
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      revoked_at: null,
      expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS),
    })
    .where(eq(mcpOAuthGrant.id, row.id));

  return {
    access_token: access.token,
    token_type: 'bearer' as const,
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.token,
    scope: row.scopes.join(' '),
  };
};

export const revokeOAuthToken = async (token: string): Promise<void> => {
  const tokenHash = hashOAuthSecret(token);
  const byAccess = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.token_hash, tokenHash),
  });
  if (byAccess) {
    await db
      .update(mcpOAuthGrant)
      .set({ revoked_at: new Date() })
      .where(eq(mcpOAuthGrant.id, byAccess.id));
    return;
  }

  const byRefresh = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.refresh_token_hash, tokenHash),
  });
  if (byRefresh) {
    await db
      .update(mcpOAuthGrant)
      .set({ revoked_at: new Date() })
      .where(eq(mcpOAuthGrant.id, byRefresh.id));
  }
};

export const resolveOAuthGrantUser = async (accessToken: string) => {
  if (accessToken.length <= OAUTH_TOKEN_LOOKUP_LENGTH) return null;
  const prefix = accessToken.slice(0, OAUTH_TOKEN_LOOKUP_LENGTH);
  const grant = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.token_prefix, prefix),
    with: {
      user: { columns: { id: true, deleted_at: true } },
      client: { columns: { client_name: true } },
    },
  });
  if (!grant || grant.revoked_at != null) return null;
  if (grant.expires_at != null && isOAuthExpiryPast(grant.expires_at)) {
    return null;
  }
  if (!verifyOAuthSecret(accessToken, grant.token_hash)) return null;
  if (grant.user.deleted_at != null) return null;

  db.update(mcpOAuthGrant)
    .set({ last_used_at: new Date() })
    .where(eq(mcpOAuthGrant.id, grant.id))
    .catch(() => undefined);

  const scopes = grant.scopes.filter(
    (scope): scope is AgentScope => scope === 'read' || scope === 'write',
  );

  return {
    userId: grant.user.id,
    scopes,
    oauthGrantId: grant.id,
    allowedCompanyIds: grant.allowed_company_ids,
    clientName: grant.client.client_name,
  };
};

export const updateOAuthGrantAllowList = async (
  grantId: number,
  userId: bigint,
  allowedCompanyIds: number[],
): Promise<boolean> => {
  const row = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.id, grantId),
    columns: { user_id: true, revoked_at: true },
  });
  if (!row || row.revoked_at != null || row.user_id !== userId) return false;
  await db
    .update(mcpOAuthGrant)
    .set({ allowed_company_ids: allowedCompanyIds })
    .where(eq(mcpOAuthGrant.id, grantId));
  return true;
};
