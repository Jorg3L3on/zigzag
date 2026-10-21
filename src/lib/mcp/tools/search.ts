import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { fetchKnowledge, searchKnowledge } from '@/lib/mcp/domain/search';
import { fetchOutputSchema, knowledgeIdSchema, searchOutputSchema } from '@/lib/mcp/schemas';
import {
  READ_ONLY_ANNOTATIONS,
  runAgentUserTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { getOAuthIssuer } from '@/lib/server/mcp-oauth/config';
import { assertScope } from '@/lib/server/resolve-agent-context';

/**
 * `search` and `fetch` with the input and output OpenAI's MCP guide asks for
 * (company knowledge / deep research), plus an optional company_id (ZIG-I23-5).
 */
export const registerSearchTools = (server: McpServer) => {
  server.registerTool(
    'search',
    {
      title: 'Buscar',
      description:
        'Busca en ZigZag por texto libre: tickets y presupuestos (folio, cliente, teléfono, conceptos, materiales, notas), clientes (nombre, teléfono, email, RFC) y servicios. Sin company_id busca en todas las compañías autorizadas. Devuelve hasta 20 resultados con id, título y url; usa fetch con el id para leer el registro completo.',
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe('Texto a buscar, p. ej. "Pérez", "R-0042" o un teléfono.'),
        company_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Limita la búsqueda a una compañía autorizada.'),
      }),
      outputSchema: searchOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentUserTool('search', ctx as McpToolContext, async (agentUser) => {
        assertScope(agentUser, 'read');
        return searchKnowledge(
          agentUser,
          { query: args.query, companyId: args.company_id },
          { issuer: getOAuthIssuer((ctx as McpToolContext).http?.req) },
        );
      }),
  );

  server.registerTool(
    'fetch',
    {
      title: 'Leer registro',
      description:
        'Lee completo un registro devuelto por search (doc:<id>, client:<id> o service:<id>): texto legible, url y metadatos.',
      inputSchema: z.object({ id: knowledgeIdSchema }),
      outputSchema: fetchOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentUserTool('fetch', ctx as McpToolContext, async (agentUser) => {
        assertScope(agentUser, 'read');
        return fetchKnowledge(agentUser, args.id, {
          issuer: getOAuthIssuer((ctx as McpToolContext).http?.req),
        });
      }),
  );
};
