import { z } from 'zod';
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

export const companyIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Id de la compañía (tenant). Debe estar en la allow-list de la conexión.');

type McpTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export const jsonResult = (data: unknown): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export const errorResult = (message: string): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  isError: true,
});

const getAuthorizationHeader = (ctx: McpToolContext): string | null =>
  ctx.http?.req?.headers.get('authorization') ?? null;

const enforceToolRateLimit = async (
  ctx: McpToolContext,
  rateLimitIdentity: number,
): Promise<McpTextResult | null> => {
  const request = ctx.http?.req;
  if (!request) return null;
  const allowed = await checkRateLimit(`mcp:tool:${rateLimitIdentity}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (allowed) return null;
  return errorResult(
    'Límite de solicitudes alcanzado para esta conexión. Reintenta en un minuto.',
  );
};

const toErrorResult = (error: unknown): McpTextResult => {
  if (error instanceof AgentAuthError) {
    return errorResult(error.message);
  }
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return errorResult(`Error de validación: ${details}`);
  }
  if (error instanceof Error && error.message) {
    return errorResult(error.message);
  }
  return errorResult('Error interno en la herramienta');
};

export async function runAgentCompanyTool(
  toolName: string,
  ctx: McpToolContext,
  args: { company_id: number },
  permission: string,
  scope: AgentScope,
  fn: (agent: AgentContext) => Promise<unknown>,
): Promise<McpTextResult> {
  try {
    const agent = await resolveAgentContext(
      getAuthorizationHeader(ctx),
      args.company_id,
      permission,
    );
    assertScope(agent, scope);

    const limitedResult = await enforceToolRateLimit(ctx, agent.rateLimitIdentity);
    if (limitedResult) return limitedResult;

    const data = await fn(agent);
    return jsonResult(data);
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function runAgentUserTool(
  toolName: string,
  ctx: McpToolContext,
  fn: (user: Awaited<ReturnType<typeof resolveAgentUser>>) => Promise<unknown>,
): Promise<McpTextResult> {
  try {
    const token = parseBearerToken(getAuthorizationHeader(ctx));
    const agentUser = await resolveAgentUser(token);

    if (agentUser.allowedCompanyIds.length === 0) {
      throw new AgentAuthError(
        'Esta conexión no tiene compañías autorizadas. Actualiza la allow-list en Conexiones.',
        403,
      );
    }

    const limitedResult = await enforceToolRateLimit(ctx, agentUser.rateLimitIdentity);
    if (limitedResult) return limitedResult;

    const data = await fn(agentUser);
    return jsonResult(data);
  } catch (error) {
    return toErrorResult(error);
  }
}
