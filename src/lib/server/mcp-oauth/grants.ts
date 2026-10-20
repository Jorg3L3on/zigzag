import { and, eq, isNull } from 'drizzle-orm';
import {
  mcpOAuthAuthorizationCode,
  mcpOAuthGrant,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { recordAgentAccessAudit } from '@/lib/server/agent-access-audit';
import type { AgentScope } from '@/lib/server/resolve-agent-context';
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_CODE_TTL_MS,
  OAUTH_GRANT_ABSOLUTE_TTL_MS,
  OAUTH_REFRESH_TOKEN_TTL_MS,
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

/** Why a grant stopped working; stored in McpOAuthGrant.revoked_reason. */
export type GrantRevokeReason =
  | 'revoked'
  | 'revoked_by_user'
  | 'refresh_reuse'
  | 'code_replay'
  | 'user_inactive'
  | 'password_changed'
  | 'password_reset'
  | 'user_deactivated';

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

/**
 * Revokes live grants matching `where` and writes one audit row per grant.
 * Returns how many grants were revoked.
 */
const revokeGrantsWhere = async (
  where: ReturnType<typeof and>,
  reason: GrantRevokeReason,
  audit: { actorUserId?: bigint; extra?: Record<string, unknown> } = {},
): Promise<number> => {
  const revoked = await db
    .update(mcpOAuthGrant)
    .set({ revoked_at: new Date(), revoked_reason: reason })
    .where(and(where, isNull(mcpOAuthGrant.revoked_at)))
    .returning({
      id: mcpOAuthGrant.id,
      user_id: mcpOAuthGrant.user_id,
      client_id: mcpOAuthGrant.client_id,
    });
  for (const grant of revoked) {
    await recordAgentAccessAudit({
      event: reason === 'refresh_reuse' ? 'oauth.refresh_reuse' : 'oauth.grant_revoked',
      userId: grant.user_id,
      resourceId: grant.id,
      actorUserId: audit.actorUserId,
      payload: { client_id: grant.client_id, reason, ...audit.extra },
    });
  }
  return revoked.length;
};

export const revokeOAuthGrant = (
  grantId: number,
  reason: GrantRevokeReason,
  audit?: { actorUserId?: bigint },
) => revokeGrantsWhere(and(eq(mcpOAuthGrant.id, grantId)), reason, audit);

/** Every live grant of a user (password change, reset, deactivation). */
export const revokeOAuthGrantsForUser = (
  userId: bigint,
  reason: GrantRevokeReason,
  audit?: { actorUserId?: bigint },
) => revokeGrantsWhere(and(eq(mcpOAuthGrant.user_id, userId)), reason, audit);

const issueGrantTimes = (nowMs = Date.now()) => {
  const absoluteExpiresAt = oauthExpiresAtFromNow(OAUTH_GRANT_ABSOLUTE_TTL_MS, nowMs);
  return {
    expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS, nowMs),
    refresh_expires_at: oauthExpiresAtFromNow(OAUTH_REFRESH_TOKEN_TTL_MS, nowMs),
    absolute_expires_at: absoluteExpiresAt,
  };
};

const tokenResponse = (access: string, refresh: string, scopes: string[]) => ({
  access_token: access,
  token_type: 'bearer' as const,
  expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
  refresh_token: refresh,
  scope: scopes.join(' '),
});

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

  if (!row) {
    throw new OAuthInvalidGrantError('not_found');
  }
  if (row.used_at != null) {
    // RFC 6749 §4.1.2: a code presented twice revokes what it already minted.
    await revokeGrantsWhere(
      and(eq(mcpOAuthGrant.authorization_code_id, row.id)),
      'code_replay',
    );
    throw new OAuthInvalidGrantError('replay');
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

  // Claim the code atomically: of two concurrent exchanges only one gets the row.
  const claimed = await db
    .update(mcpOAuthAuthorizationCode)
    .set({ used_at: new Date() })
    .where(
      and(
        eq(mcpOAuthAuthorizationCode.id, row.id),
        isNull(mcpOAuthAuthorizationCode.used_at),
      ),
    )
    .returning({ id: mcpOAuthAuthorizationCode.id });
  if (claimed.length === 0) {
    throw new OAuthInvalidGrantError('replay');
  }

  return issueGrant({
    userId: row.user_id,
    clientId: row.client_id,
    scopes: row.scopes.filter(
      (scope): scope is AgentScope => scope === 'read' || scope === 'write',
    ),
    allowedCompanyIds: row.allowed_company_ids,
    resource: normalizeMcpResourceUrl(row.resource, input.request),
    authorizationCodeId: row.id,
  });
};

export const issueGrant = async (input: {
  userId: bigint;
  clientId: string;
  scopes: AgentScope[];
  allowedCompanyIds: number[];
  resource: string;
  authorizationCodeId?: number;
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
    authorization_code_id: input.authorizationCodeId ?? null,
    ...issueGrantTimes(),
  });

  return tokenResponse(access.token, refresh.token, input.scopes);
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

  if (!row) {
    // A rotated-out refresh token coming back means it leaked: kill the grant.
    const reused = await db.query.mcpOAuthGrant.findFirst({
      where: eq(mcpOAuthGrant.previous_refresh_token_hash, refreshHash),
      columns: { id: true },
    });
    if (reused) {
      await revokeOAuthGrant(reused.id, 'refresh_reuse');
      throw new OAuthInvalidGrantError('reuse');
    }
    throw new OAuthInvalidGrantError('not_found');
  }
  if (row.revoked_at != null) {
    throw new OAuthInvalidGrantError('other');
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

  const nowMs = Date.now();
  if (
    (row.refresh_expires_at != null && isOAuthExpiryPast(row.refresh_expires_at, nowMs)) ||
    (row.absolute_expires_at != null && isOAuthExpiryPast(row.absolute_expires_at, nowMs))
  ) {
    throw new OAuthInvalidGrantError('expired');
  }

  const owner = await db.query.user.findFirst({
    where: and(eq(user.id, row.user_id), isNull(user.deleted_at)),
    columns: { id: true },
  });
  if (!owner) {
    await revokeOAuthGrant(row.id, 'user_inactive');
    throw new OAuthInvalidGrantError('user');
  }
  // Imported lazily: resolve-agent-context imports this module.
  const { resolveAccessibleCompanyIds } = await import(
    '@/lib/server/resolve-agent-context'
  );
  const accessible = await resolveAccessibleCompanyIds(
    row.user_id,
    row.allowed_company_ids,
  );
  if (accessible.length === 0) {
    throw new OAuthInvalidGrantError('user');
  }

  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();
  const refreshExpiresAt = oauthExpiresAtFromNow(OAUTH_REFRESH_TOKEN_TTL_MS, nowMs);
  const absoluteExpiresAt =
    row.absolute_expires_at ??
    oauthExpiresAtFromNow(OAUTH_GRANT_ABSOLUTE_TTL_MS, row.created_at.getTime());

  // Compare-and-swap on the refresh hash so two concurrent refreshes cannot both rotate.
  const rotated = await db
    .update(mcpOAuthGrant)
    .set({
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      previous_refresh_token_hash: refreshHash,
      expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS, nowMs),
      refresh_expires_at:
        refreshExpiresAt.getTime() < absoluteExpiresAt.getTime()
          ? refreshExpiresAt
          : absoluteExpiresAt,
      absolute_expires_at: absoluteExpiresAt,
    })
    .where(
      and(
        eq(mcpOAuthGrant.id, row.id),
        eq(mcpOAuthGrant.refresh_token_hash, refreshHash),
        isNull(mcpOAuthGrant.revoked_at),
      ),
    )
    .returning({ id: mcpOAuthGrant.id });
  if (rotated.length === 0) {
    throw new OAuthInvalidGrantError('reuse');
  }

  return tokenResponse(access.token, refresh.token, row.scopes);
};

/** RFC 7009: revoke by access or refresh token. Unknown tokens are a no-op. */
export const revokeOAuthToken = async (token: string): Promise<void> => {
  const tokenHash = hashOAuthSecret(token);
  const grant = await db.query.mcpOAuthGrant.findFirst({
    where: eq(mcpOAuthGrant.token_hash, tokenHash),
    columns: { id: true },
  });
  const byRefresh =
    grant ??
    (await db.query.mcpOAuthGrant.findFirst({
      where: eq(mcpOAuthGrant.refresh_token_hash, tokenHash),
      columns: { id: true },
    }));
  if (byRefresh) {
    await revokeOAuthGrant(byRefresh.id, 'revoked');
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
