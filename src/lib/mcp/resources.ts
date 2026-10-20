import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer,
} from '@modelcontextprotocol/server';
import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import { getCompanyPaymentInfo } from '@/lib/company-payment-info';
import { resolveFolioPrefix } from '@/lib/folio';
import { logger } from '@/lib/logger';
import { listAgentCompanies } from '@/lib/mcp/domain';
import { listAgentServices } from '@/lib/mcp/domain/catalog';
import { toJsonSafe, type McpToolContext } from '@/lib/mcp/tool-helpers';
import { checkRateLimit } from '@/lib/rate-limiter';
import { checkUserPermission } from '@/lib/security';
import {
  AgentAuthError,
  assertScope,
  parseBearerToken,
  resolveAgentContext,
  resolveAgentUser,
  type AgentContext,
} from '@/lib/server/resolve-agent-context';

/**
 * Read-only resources (ZIG-I23-10): the company profile and its catalog, one
 * pair per company in the connection's allow-list that the user can access.
 *
 *   zigzag://company/<id>/profile  (tickets.read: it is what documents print)
 *   zigzag://company/<id>/catalog  (services.read, like the Servicios page)
 */

const RESOURCE_KINDS = {
  profile: {
    permission: 'tickets.read',
    title: (name: string) => `Perfil de ${name}`,
    description:
      'Datos del emisor: nombre, contacto, dirección, datos de transferencia y prefijos de folio.',
  },
  catalog: {
    permission: 'services.read',
    title: (name: string) => `Catálogo de ${name}`,
    description: 'Servicios con sus materiales por defecto (cantidad y precio para ese servicio).',
  },
} as const;

type ResourceKind = keyof typeof RESOURCE_KINDS;

export const companyResourceUri = (companyId: number, kind: ResourceKind) =>
  `zigzag://company/${companyId}/${kind}`;

/** Upper bound for the catalog resource; list_services pages past it. */
export const CATALOG_RESOURCE_MAX_SERVICES = 500;

export const getCompanyProfile = async (companyId: number) => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: {
      street: row.street,
      exterior_number: row.exterior_number,
      interior_number: row.interior_number,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      postal_code: row.postal_code,
      country: row.country,
    },
    payment_info: getCompanyPaymentInfo(row.settings),
    folio_prefixes: {
      ticket: resolveFolioPrefix('ticket', row.settings),
      presupuesto: resolveFolioPrefix('presupuesto', row.settings),
    },
  };
};

export const getCompanyCatalog = async (agent: AgentContext) => {
  const services: Awaited<ReturnType<typeof listAgentServices>>['services'] = [];
  let cursor: string | undefined;
  do {
    const page = await listAgentServices(agent, { limit: 100, cursor });
    services.push(...page.services);
    cursor = page.next_cursor ?? undefined;
  } while (cursor && services.length < CATALOG_RESOURCE_MAX_SERVICES);
  return {
    company_id: agent.companyId,
    services: services.slice(0, CATALOG_RESOURCE_MAX_SERVICES),
    truncated: Boolean(cursor) || services.length > CATALOG_RESOURCE_MAX_SERVICES,
  };
};

const authorizationHeader = (ctx: McpToolContext) =>
  ctx.http?.req?.headers.get('authorization') ?? null;

const assertNotRateLimited = async (rateLimitIdentity: number) => {
  const allowed = await checkRateLimit(`mcp:tool:${rateLimitIdentity}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!allowed) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidRequest,
      'Límite de solicitudes alcanzado para esta conexión. Reintenta en un minuto.',
    );
  }
};

/** Resources of one kind for every allow-listed company the user may read. */
const listCompanyResources = async (kind: ResourceKind, ctx: McpToolContext) => {
  const agentUser = await resolveAgentUser(parseBearerToken(authorizationHeader(ctx)));
  if (!agentUser.scopes.includes('read')) return { resources: [] };
  const companies = await listAgentCompanies(agentUser);
  const readable = await Promise.all(
    companies.map(async (row) =>
      (await checkUserPermission(String(agentUser.userId), row.id, RESOURCE_KINDS[kind].permission))
        ? row
        : null,
    ),
  );
  return {
    resources: readable
      .filter((row): row is (typeof companies)[number] => row !== null)
      .map((row) => ({
        uri: companyResourceUri(row.id, kind),
        name: `company-${row.id}-${kind}`,
        title: RESOURCE_KINDS[kind].title(row.name),
        description: RESOURCE_KINDS[kind].description,
        mimeType: 'application/json',
      })),
  };
};

const readCompanyResource = async (
  kind: ResourceKind,
  uri: URL,
  rawCompanyId: string | string[] | undefined,
  ctx: McpToolContext,
) => {
  const companyId = Number(Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new ResourceNotFoundError(uri.href);
  }
  try {
    const agent = await resolveAgentContext(
      authorizationHeader(ctx),
      companyId,
      RESOURCE_KINDS[kind].permission,
    );
    assertScope(agent, 'read');
    await assertNotRateLimited(agent.rateLimitIdentity);

    const data = kind === 'profile' ? await getCompanyProfile(companyId) : await getCompanyCatalog(agent);
    if (!data) throw new ResourceNotFoundError(uri.href);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(toJsonSafe(data)),
        },
      ],
    };
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    if (error instanceof AgentAuthError) {
      // Outside the allow-list or without the permission reads as missing, with
      // the same Spanish message the tools give.
      if (error.status === 401) {
        throw new ProtocolError(ProtocolErrorCode.InvalidRequest, error.message);
      }
      throw new ResourceNotFoundError(uri.href, error.message);
    }
    logger.error('mcp resource failed', {
      resource: kind,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      'Error interno al leer el recurso. Intenta de nuevo más tarde.',
    );
  }
};

export const registerMcpResources = (server: McpServer) => {
  for (const kind of Object.keys(RESOURCE_KINDS) as ResourceKind[]) {
    server.registerResource(
      `company-${kind}`,
      new ResourceTemplate(`zigzag://company/{company_id}/${kind}`, {
        list: (ctx) => listCompanyResources(kind, ctx as McpToolContext),
      }),
      {
        title: kind === 'profile' ? 'Perfil de la compañía' : 'Catálogo de la compañía',
        description: RESOURCE_KINDS[kind].description,
        mimeType: 'application/json',
      },
      (uri, variables, ctx) =>
        readCompanyResource(kind, uri, variables.company_id, ctx as McpToolContext),
    );
  }
};
