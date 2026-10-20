import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  createAgentTicket,
  getAgentIdentity,
  getAgentTicket,
  listAgentCompanies,
  listAgentTickets,
  updateAgentTicketStatus,
} from '@/lib/mcp/domain';
import { parseAgentTicketId } from '@/lib/mcp/serialize-ticket';
import { registerCatalogTools } from '@/lib/mcp/tools/catalog';
import { registerDocumentTools } from '@/lib/mcp/tools/documents';
import { registerSearchTools } from '@/lib/mcp/tools/search';
import {
  getTicketOutputSchema,
  listCompaniesOutputSchema,
  listTicketsOutputSchema,
  ticketWriteOutputSchema,
  whoamiSchema,
} from '@/lib/mcp/schemas';
import {
  companyIdSchema,
  READ_ONLY_ANNOTATIONS,
  runAgentCompanyTool,
  runAgentUserTool,
  writeAnnotations,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

const ticketIdSchema = z
  .union([z.string(), z.number()])
  .describe('Id del ticket (BigInt como string o número).');

export const registerMcpTools = (server: McpServer) => {
  server.registerTool(
    'whoami',
    {
      title: 'Quién soy',
      description:
        'Indica a qué usuario de ZigZag pertenece esta conexión, cómo se autenticó, sus scopes y las compañías autorizadas. Llámala primero.',
      outputSchema: whoamiSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: { 'openai/profile': true },
    },
    async (ctx) =>
      runAgentUserTool(
        'whoami',
        ctx as McpToolContext,
        async (agentUser) => {
          const [identity, companies] = await Promise.all([
            getAgentIdentity(agentUser),
            listAgentCompanies(agentUser),
          ]);
          return {
            user: identity.user,
            auth_source: agentUser.authSource,
            connection_label: identity.connectionLabel,
            scopes: agentUser.scopes,
            companies,
          };
        },
        { requireCompanies: false },
      ),
  );

  server.registerTool(
    'list_companies',
    {
      title: 'Listar compañías',
      description:
        'Lista las compañías autorizadas para esta conexión que el usuario puede ver.',
      outputSchema: listCompaniesOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (ctx) =>
      runAgentUserTool('list_companies', ctx as McpToolContext, async (agentUser) => ({
        companies: await listAgentCompanies(agentUser),
      })),
  );

  server.registerTool(
    'list_tickets',
    {
      title: 'Listar tickets',
      description:
        'Obsoleta (deprecated): usa list_documents. Lista tickets de una compañía autorizada (formato v1, se retirará).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        limit: z.number().int().min(1).max(100).optional(),
        finished: z.boolean().optional(),
      }),
      outputSchema: listTicketsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_tickets',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => ({
          tickets: await listAgentTickets(agent, {
            limit: args.limit,
            finished: args.finished ?? null,
          }),
        }),
      ),
  );

  server.registerTool(
    'get_ticket',
    {
      title: 'Obtener ticket',
      description:
        'Obsoleta (deprecated): usa get_document. Obtiene un ticket por id dentro de una compañía autorizada (formato v1, se retirará).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        ticket_id: ticketIdSchema,
      }),
      outputSchema: getTicketOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'get_ticket',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => ({
          ticket: await getAgentTicket(agent, parseAgentTicketId(args.ticket_id)),
        }),
      ),
  );

  server.registerTool(
    'create_ticket',
    {
      title: 'Crear ticket',
      description: 'Crea un ticket en una compañía autorizada (scope write).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        client_name: z.string().min(1).max(100),
        client_tel: z.string().min(1).max(20),
        client_id: z.number().int().positive().optional(),
        email: z.string().email().max(40).optional(),
      }),
      outputSchema: ticketWriteOutputSchema,
      annotations: writeAnnotations({ idempotent: false }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'create_ticket',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'write',
        async (agent) => ({
          ticket: await createAgentTicket(agent, args),
        }),
      ),
  );

  server.registerTool(
    'update_ticket_status',
    {
      title: 'Cambiar estado del ticket',
      description:
        'Marca un ticket como terminado o reabre (scope write). No registra pagos.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        ticket_id: ticketIdSchema,
        finished: z.boolean(),
      }),
      outputSchema: ticketWriteOutputSchema,
      // Reopening undoes it, so it is not destructive; same input, same state.
      annotations: writeAnnotations({ idempotent: true }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'update_ticket_status',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'write',
        async (agent) => ({
          ticket: await updateAgentTicketStatus(
            agent,
            parseAgentTicketId(args.ticket_id),
            args.finished,
          ),
        }),
      ),
  );

  registerCatalogTools(server);
  registerDocumentTools(server);
  registerSearchTools(server);
};
