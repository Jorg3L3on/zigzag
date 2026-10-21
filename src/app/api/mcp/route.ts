import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerMcpPrompts } from '@/lib/mcp/prompts';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { registerMcpResources } from '@/lib/mcp/resources';
import { verifyMcpBearerToken } from '@/lib/server/mcp-bearer-auth';

const mcpHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
    registerMcpPrompts(server);
    registerMcpResources(server);
  },
  {
    serverInfo: { name: 'zigzag', version: '2.0.0' },
    capabilities: {
      tools: { listChanged: true },
      prompts: { listChanged: false },
      resources: { listChanged: false },
    },
    instructions:
      'Conector MCP de ZigZag. Llama whoami primero para saber a qué cuenta pertenece la conexión, sus scopes y sus compañías; después list_companies cuando necesites elegir compañía. Todas las demás herramientas requieren company_id en la allow-list. Los resultados vienen en structuredContent; los errores traen error.code (unauthorized, forbidden, not_found, validation, rate_limited, internal).\n' +
      'Prompts listos: cobranza_de_hoy (recordatorios de WhatsApp de lo que se cobra hoy), ticket_desde_mensaje (propone un ticket a partir de un mensaje de WhatsApp y espera confirmación) y resumen_cliente.\n' +
      'Recursos de solo lectura por compañía autorizada: zigzag://company/<id>/profile (emisor, dirección, datos de transferencia, prefijos de folio) y zigzag://company/<id>/catalog (servicios con materiales por defecto).',
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
export const DELETE = withCors(authenticatedHandler);

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
