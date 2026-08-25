import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { verifyMcpBearerToken } from '@/lib/server/mcp-bearer-auth';

const mcpHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: { name: 'zigzag', version: '1.0.0' },
    capabilities: {
      tools: { listChanged: true },
    },
    instructions:
      'Conector MCP de ZigZag (tickets). Llama list_companies primero para ver qué compañías autorizó el usuario. Todas las demás herramientas requieren company_id en la allow-list.',
  },
);

const authenticatedHandler = withMcpAuth(mcpHandler, verifyMcpBearerToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Expose-Headers':
    'mcp-session-id, mcp-protocol-version, WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
};

const withCors =
  (base: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    const response = await base(request);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  };

export const GET = withCors(authenticatedHandler);
export const POST = withCors(authenticatedHandler);

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
