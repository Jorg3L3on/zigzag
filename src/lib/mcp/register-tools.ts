import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  createAgentTicket,
  getAgentTicket,
  listAgentClients,
  listAgentCompanies,
  listAgentTickets,
  updateAgentTicketStatus,
} from '@/lib/mcp/domain';
import {
  companyIdSchema,
  runAgentCompanyTool,
  runAgentUserTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

export const registerMcpTools = (server: McpServer) => {
  server.registerTool(
    'list_companies',
    {
      title: 'Listar compañías',
      description:
        'Lista las compañías autorizadas para esta conexión que el usuario puede ver.',
      annotations: { readOnlyHint: true },
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
      description: 'Lista tickets de una compañía autorizada.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        limit: z.number().int().min(1).max(100).optional(),
        finished: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true },
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
      description: 'Obtiene un ticket por id dentro de una compañía autorizada.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        ticket_id: z.string().describe('Id del ticket (BigInt como string).'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'get_ticket',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => ({
          ticket: await getAgentTicket(agent, BigInt(args.ticket_id)),
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
      annotations: { destructiveHint: false },
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
        ticket_id: z.string(),
        finished: z.boolean(),
      }),
      annotations: { destructiveHint: true },
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
            BigInt(args.ticket_id),
            args.finished,
          ),
        }),
      ),
  );

  server.registerTool(
    'list_clients',
    {
      title: 'Listar clientes',
      description:
        'Lista clientes de una compañía (campos mínimos, sin teléfono ni dirección).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        limit: z.number().int().min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_clients',
        ctx as McpToolContext,
        args,
        'clients.read',
        'read',
        async (agent) => ({
          clients: await listAgentClients(agent, { limit: args.limit }),
        }),
      ),
  );
};
