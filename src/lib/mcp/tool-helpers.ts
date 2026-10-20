import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { McpErrorCode } from '@/lib/mcp/schemas';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  AgentAuthError,
  assertScope,
  parseBearerToken,
  resolveAgentContext,
  resolveAgentUser,
  type AgentContext,
  type AgentScope,
} from '@/lib/server/resolve-agent-context';

export type McpToolContext = {
  http?: { req?: Request };
};

export type AgentUser = Awaited<ReturnType<typeof resolveAgentUser>>;

export const companyIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Id de la compañía (tenant). Debe estar en la allow-list de la conexión.');

/* ------------------------------------------------------------------------- */
/* Annotations                                                               */
/* ------------------------------------------------------------------------- */

/** list_*, get_*, search, fetch, whoami. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Writes inside ZigZag. `destructive` only when the change cannot be undone
 * from the app (a reopen or a status flip is not destructive).
 */
export const writeAnnotations = (opts: {
  idempotent: boolean;
  destructive?: boolean;
}) =>
  ({
    readOnlyHint: false,
    destructiveHint: opts.destructive ?? false,
    idempotentHint: opts.idempotent,
    openWorldHint: false,
  }) as const;

/* ------------------------------------------------------------------------- */
/* Results                                                                   */
/* ------------------------------------------------------------------------- */

type JsonObject = Record<string, unknown>;

export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: JsonObject;
  isError?: boolean;
  _meta?: JsonObject;
};

/**
 * Plain JSON copy of a tool payload: BigInt → string, Date → ISO string
 * (`toJSON`), undefined fields dropped. This is what `outputSchema` describes.
 */
export const toJsonSafe = <T>(data: T): unknown =>
  JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

/**
 * Successful tool result: `structuredContent` plus the same JSON as a text
 * block, for clients that only read `content`.
 */
export const toolResult = (data: JsonObject): McpToolResult => {
  const structuredContent = toJsonSafe(data) as JsonObject;
  return {
    structuredContent,
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
  };
};

export type ValidationIssue = { path: string; message: string };

/**
 * Coded tool error. `message` is shown to the model, so it must be Spanish and
 * safe to expose; unknown errors never reach here with their own message.
 */
export const errorResult = (
  code: McpErrorCode,
  message: string,
  extra?: { issues?: ValidationIssue[]; _meta?: JsonObject },
): McpToolResult => {
  const structuredContent = {
    error: {
      code,
      message,
      ...(extra?.issues ? { issues: extra.issues } : {}),
    },
  };
  return {
    structuredContent,
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
    isError: true,
    ...(extra?._meta ? { _meta: extra._meta } : {}),
  };
};

/**
 * Throw from a tool body (or the domain layer) to return a specific code with
 * a message that is safe to show, e.g. `new McpToolError('not_found', '…')`.
 */
export class McpToolError extends Error {
  readonly code: McpErrorCode;

  constructor(code: McpErrorCode, message: string) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
  }
}

const INTERNAL_MESSAGE = 'Error interno en la herramienta. Intenta de nuevo más tarde.';

/** Domain messages that predate McpToolError and are safe to show. */
const KNOWN_DOMAIN_ERRORS: Record<string, McpErrorCode> = {
  'Ticket no encontrado': 'not_found',
  'ticket_id inválido': 'validation',
};

const authStatusToCode = (status: number): McpErrorCode => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 400 || status === 422) return 'validation';
  return 'internal';
};

/** Maps any thrown value to a coded error result without leaking internals. */
export const toErrorResult = (error: unknown, toolName?: string): McpToolResult => {
  if (error instanceof McpToolError) {
    return errorResult(error.code, error.message);
  }
  if (error instanceof AgentAuthError) {
    const code = authStatusToCode(error.status);
    return errorResult(code, code === 'internal' ? INTERNAL_MESSAGE : error.message);
  }
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '(root)',
      message: issue.message,
    }));
    const details = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    return errorResult('validation', `Error de validación: ${details}`, { issues });
  }
  if (error instanceof Error && KNOWN_DOMAIN_ERRORS[error.message]) {
    return errorResult(KNOWN_DOMAIN_ERRORS[error.message], error.message);
  }
  logger.error('mcp tool failed', {
    tool: toolName,
    error: error instanceof Error ? error.message : String(error),
  });
  return errorResult('internal', INTERNAL_MESSAGE);
};

/* ------------------------------------------------------------------------- */
/* Runners                                                                   */
/* ------------------------------------------------------------------------- */

const getAuthorizationHeader = (ctx: McpToolContext): string | null =>
  ctx.http?.req?.headers.get('authorization') ?? null;

const enforceToolRateLimit = async (
  ctx: McpToolContext,
  rateLimitIdentity: number,
): Promise<McpToolResult | null> => {
  const request = ctx.http?.req;
  if (!request) return null;
  const allowed = await checkRateLimit(`mcp:tool:${rateLimitIdentity}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (allowed) return null;
  return errorResult(
    'rate_limited',
    'Límite de solicitudes alcanzado para esta conexión. Reintenta en un minuto.',
  );
};

/**
 * Tool scoped to one company: resolves the agent (resolveAgentContext runs
 * assertAgentCompanyAccess and checkUserPermission), checks the token scope,
 * rate-limits and wraps the payload with `toolResult`.
 */
export async function runAgentCompanyTool(
  toolName: string,
  ctx: McpToolContext,
  args: { company_id: number },
  permission: string,
  scope: AgentScope,
  fn: (agent: AgentContext) => Promise<JsonObject>,
): Promise<McpToolResult> {
  try {
    const agent = await resolveAgentContext(
      getAuthorizationHeader(ctx),
      args.company_id,
      permission,
    );
    assertScope(agent, scope);

    const limitedResult = await enforceToolRateLimit(ctx, agent.rateLimitIdentity);
    if (limitedResult) return limitedResult;

    return toolResult(await fn(agent));
  } catch (error) {
    return toErrorResult(error, toolName);
  }
}

/**
 * Tool without company_id (list_companies, whoami). By default the connection
 * must allow at least one company; whoami passes `requireCompanies: false` so
 * it can still say who the token belongs to.
 */
export async function runAgentUserTool(
  toolName: string,
  ctx: McpToolContext,
  fn: (user: AgentUser) => Promise<JsonObject>,
  opts: { requireCompanies?: boolean } = {},
): Promise<McpToolResult> {
  try {
    const token = parseBearerToken(getAuthorizationHeader(ctx));
    const agentUser = await resolveAgentUser(token);

    if ((opts.requireCompanies ?? true) && agentUser.allowedCompanyIds.length === 0) {
      throw new AgentAuthError(
        'Esta conexión no tiene compañías autorizadas. Actualiza la allow-list en Conexiones.',
        403,
      );
    }

    const limitedResult = await enforceToolRateLimit(ctx, agentUser.rateLimitIdentity);
    if (limitedResult) return limitedResult;

    return toolResult(await fn(agentUser));
  } catch (error) {
    return toErrorResult(error, toolName);
  }
}
