import { and, eq, inArray, isNull } from 'drizzle-orm';
import { apiKey, company, user } from '@/db/schema';
import { db } from '@/lib/db';
import { companyAllowsAuthentication } from '@/lib/company-lifecycle';
import { checkUserPermission } from '@/lib/security';
import {
  AGENT_TOKEN_LOOKUP_LENGTH,
  AGENT_TOKEN_PREFIX,
  hashAgentToken,
  isLegacyAgentTokenHash,
  verifyAgentToken,
} from '@/lib/server/agent-token';
import { OAUTH_ACCESS_TOKEN_PREFIX } from '@/lib/server/mcp-oauth/config';
import { resolveOAuthGrantUser } from '@/lib/server/mcp-oauth/grants';
import { isOAuthExpiryPast } from '@/lib/server/mcp-oauth/oauth-expiry';

export { AGENT_TOKEN_LOOKUP_LENGTH, AGENT_TOKEN_PREFIX };

export type AgentScope = 'read' | 'write';

export type AgentAuthSource = 'api_key' | 'oauth_grant';

export type AgentContext = {
  userId: bigint;
  scopes: AgentScope[];
  allowedCompanyIds: number[];
  authSource: AgentAuthSource;
  apiKeyId?: number;
  oauthGrantId?: number;
  rateLimitIdentity: number;
  companyId: number;
};

export class AgentAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentAuthError';
    this.status = status;
  }
}

const unauthorized = (message = 'Token de agente inválido') =>
  new AgentAuthError(message, 401);

const forbidden = (message = 'Forbidden') => new AgentAuthError(message, 403);

export const parseBearerToken = (
  authorizationHeader: string | null | undefined,
): string => {
  const header = authorizationHeader?.trim();
  if (!header?.toLowerCase().startsWith('bearer ')) {
    throw unauthorized('Falta el encabezado Authorization: Bearer');
  }
  const token = header.slice('bearer '.length).trim();
  if (!token) {
    throw unauthorized();
  }
  return token;
};

const isApiKeyToken = (token: string): boolean =>
  token.startsWith(AGENT_TOKEN_PREFIX) && !token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);

const isOAuthAccessToken = (token: string): boolean =>
  token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);

export async function resolveAgentUser(token: string): Promise<{
  userId: bigint;
  scopes: AgentScope[];
  allowedCompanyIds: number[];
  authSource: AgentAuthSource;
  apiKeyId?: number;
  oauthGrantId?: number;
  rateLimitIdentity: number;
}> {
  if (isOAuthAccessToken(token)) {
    const oauthUser = await resolveOAuthGrantUser(token);
    if (!oauthUser) throw unauthorized('Token OAuth inválido o expirado');
    return {
      userId: oauthUser.userId,
      scopes: oauthUser.scopes,
      allowedCompanyIds: oauthUser.allowedCompanyIds,
      authSource: 'oauth_grant',
      oauthGrantId: oauthUser.oauthGrantId,
      rateLimitIdentity: -oauthUser.oauthGrantId,
    };
  }

  if (!isApiKeyToken(token)) {
    throw unauthorized();
  }

  if (token.length <= AGENT_TOKEN_LOOKUP_LENGTH) {
    throw unauthorized();
  }
  const keyPrefix = token.slice(0, AGENT_TOKEN_LOOKUP_LENGTH);

  const row = await db.query.apiKey.findFirst({
    where: eq(apiKey.key_prefix, keyPrefix),
    with: {
      user: { columns: { id: true, deleted_at: true } },
    },
  });

  if (!row || row.revoked_at != null) {
    throw unauthorized();
  }

  if (row.expires_at != null && isOAuthExpiryPast(row.expires_at)) {
    throw unauthorized('Token de agente expirado');
  }

  const matches = await verifyAgentToken(token, row.key_hash);
  if (!matches) {
    throw unauthorized();
  }

  if (row.user.deleted_at != null) {
    throw forbidden('Usuario inactivo');
  }

  db.update(apiKey)
    .set({
      last_used_at: new Date(),
      ...(isLegacyAgentTokenHash(row.key_hash)
        ? { key_hash: hashAgentToken(token) }
        : {}),
    })
    .where(eq(apiKey.id, row.id))
    .catch(() => undefined);

  const scopes = row.scopes.filter(
    (scope): scope is AgentScope => scope === 'read' || scope === 'write',
  );

  return {
    userId: row.user.id,
    scopes,
    allowedCompanyIds: row.allowed_company_ids,
    authSource: 'api_key',
    apiKeyId: row.id,
    rateLimitIdentity: row.id,
  };
}

export async function resolveAccessibleCompanyIds(
  userId: bigint,
  allowedCompanyIds: number[],
): Promise<number[]> {
  if (allowedCompanyIds.length === 0) return [];

  const userRow = await db.query.user.findFirst({
    where: and(eq(user.id, userId), isNull(user.deleted_at)),
    with: { company: true },
  });
  if (!userRow?.company || userRow.company.deleted_at) return [];

  if (userRow.company.is_system) {
    const rows = await db
      .select({ id: company.id })
      .from(company)
      .where(
        and(
          inArray(company.id, allowedCompanyIds),
          isNull(company.deleted_at),
        ),
      );
    return rows.map((row) => row.id);
  }

  if (
    userRow.company_id != null &&
    allowedCompanyIds.includes(userRow.company_id)
  ) {
    const tenantCompany = await db.query.company.findFirst({
      where: and(eq(company.id, userRow.company_id), isNull(company.deleted_at)),
      columns: { id: true, status: true },
    });
    if (tenantCompany && companyAllowsAuthentication(tenantCompany.status)) {
      return [tenantCompany.id];
    }
  }

  return [];
}

export async function assertAgentCompanyAccess(
  agent: Pick<AgentContext, 'userId' | 'allowedCompanyIds'>,
  companyId: number,
  permission: string,
): Promise<void> {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AgentAuthError('company_id inválido', 400);
  }

  if (agent.allowedCompanyIds.length === 0) {
    throw forbidden(
      'Esta conexión no tiene compañías autorizadas. Actualiza la allow-list en Conexiones.',
    );
  }

  if (!agent.allowedCompanyIds.includes(companyId)) {
    throw forbidden('Compañía no autorizada para esta conexión');
  }

  const accessible = await resolveAccessibleCompanyIds(
    agent.userId,
    agent.allowedCompanyIds,
  );
  if (!accessible.includes(companyId)) {
    throw forbidden('Sin acceso a esta compañía');
  }

  const allowed = await checkUserPermission(String(agent.userId), companyId, permission);
  if (!allowed) {
    throw forbidden(`Permiso "${permission}" requerido para esta compañía`);
  }
}

export async function resolveAgentContext(
  authorizationHeader: string | null | undefined,
  companyId: number,
  permission: string,
): Promise<AgentContext> {
  const token = parseBearerToken(authorizationHeader);
  const agentUser = await resolveAgentUser(token);
  await assertAgentCompanyAccess(agentUser, companyId, permission);
  return { ...agentUser, companyId };
}

export function assertScope(
  context: Pick<AgentContext, 'scopes'>,
  scope: AgentScope,
): void {
  if (!context.scopes.includes(scope)) {
    throw forbidden(`El token no tiene el scope "${scope}"`);
  }
}
