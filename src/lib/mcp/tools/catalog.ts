import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listAgentMaterials, listAgentServices } from '@/lib/mcp/domain/catalog';
import { getAgentClient, listAgentClients } from '@/lib/mcp/domain/clients';
import {
  cursorSchema,
  getClientOutputSchema,
  listClientsOutputSchema,
  listLimitSchema,
  listMaterialsOutputSchema,
  listServicesOutputSchema,
  searchQuerySchema,
} from '@/lib/mcp/schemas';
import {
  companyIdSchema,
  READ_ONLY_ANNOTATIONS,
  runAgentCompanyTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { assertAgentCompanyAccess } from '@/lib/server/resolve-agent-context';

/** Same permission as the Servicios page; materials are edited from there too. */
const CATALOG_READ_PERMISSION = 'services.read';

const pagedListInput = {
  company_id: companyIdSchema,
  query: searchQuerySchema.optional(),
  limit: listLimitSchema.optional(),
  cursor: cursorSchema.optional(),
};

/** Catalog and client read tools (ZIG-I23-4). */
export const registerCatalogTools = (server: McpServer) => {
  server.registerTool(
    'list_services',
    {
      title: 'Listar servicios',
      description:
        'Lista el catálogo de servicios de una compañía con sus materiales por defecto (cantidad y precio para ese servicio). Busca por nombre o descripción con query; pagina con cursor.',
      inputSchema: z.object(pagedListInput),
      outputSchema: listServicesOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_services',
        ctx as McpToolContext,
        args,
        CATALOG_READ_PERMISSION,
        'read',
        async (agent) => listAgentServices(agent, args),
      ),
  );

  server.registerTool(
    'list_materials',
    {
      title: 'Listar materiales',
      description:
        'Lista el catálogo de materiales de una compañía (unidad y precio por unidad). Busca por nombre con query; pagina con cursor.',
      inputSchema: z.object(pagedListInput),
      outputSchema: listMaterialsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_materials',
        ctx as McpToolContext,
        args,
        CATALOG_READ_PERMISSION,
        'read',
        async (agent) => listAgentMaterials(agent, args),
      ),
  );

  server.registerTool(
    'list_clients',
    {
      title: 'Listar clientes',
      description:
        'Lista clientes de una compañía (campos mínimos, sin teléfono ni dirección; usa get_client para el detalle). Busca por nombre, email, documento o teléfono con query; pagina con cursor.',
      inputSchema: z.object(pagedListInput),
      outputSchema: listClientsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_clients',
        ctx as McpToolContext,
        args,
        'clients.read',
        'read',
        async (agent) => listAgentClients(agent, args),
      ),
  );

  server.registerTool(
    'get_client',
    {
      title: 'Obtener cliente',
      description:
        'Obtiene el expediente de un cliente: teléfono, email, dirección estructurada, notas, saldo pendiente y sus últimos 10 documentos (tickets y presupuestos). Requiere clients.read y tickets.read.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        client_id: z.number().int().positive().describe('Id del cliente.'),
      }),
      outputSchema: getClientOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'get_client',
        ctx as McpToolContext,
        args,
        'clients.read',
        'read',
        async (agent) => {
          // Balance and documents come from tickets, as on the client page.
          await assertAgentCompanyAccess(agent, agent.companyId, 'tickets.read');
          return { client: await getAgentClient(agent, args.client_id) };
        },
      ),
  );
};
