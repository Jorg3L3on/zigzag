import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  getAgentCompanySummary,
  getAgentDocument,
  listAgentDocuments,
} from '@/lib/mcp/domain/documents';
import {
  companySummaryOutputSchema,
  documentPaymentStatusSchema,
  getDocumentOutputSchema,
  listDocumentsOutputSchema,
} from '@/lib/mcp/schemas';
import { parseAgentTicketId } from '@/lib/mcp/serialize-ticket';
import {
  companyIdSchema,
  McpToolError,
  READ_ONLY_ANNOTATIONS,
  runAgentCompanyTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { getOAuthIssuer } from '@/lib/server/mcp-oauth/config';

const isoDateSchema = z.iso.date();

export const documentIdSchema = z
  .union([z.string(), z.number()])
  .describe('Id del documento (ticket o presupuesto), como string o número.');

const parseDocumentId = (value: string | number): bigint => {
  try {
    return parseAgentTicketId(value);
  } catch {
    throw new McpToolError('validation', 'document_id inválido');
  }
};

/** Registers list_documents, get_document and get_company_summary (ZIG-I23-3). */
export const registerDocumentTools = (server: McpServer) => {
  server.registerTool(
    'list_documents',
    {
      title: 'Listar documentos',
      description:
        'Lista tickets y presupuestos de una compañía, del más reciente al más antiguo. Filtra por tipo, cliente, folio, fechas (ticket_date), estado de pago, terminado y texto (nombre del cliente o folio). Pagina con next_cursor hasta que sea null.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        kind: z
          .enum(['ticket', 'presupuesto', 'all'])
          .optional()
          .describe('ticket, presupuesto o all (predeterminado).'),
        client_id: z.number().int().positive().optional(),
        folio: z
          .string()
          .min(1)
          .max(20)
          .optional()
          .describe('Folio con o sin prefijo: R-0012, P-3 o 12.'),
        date_from: isoDateSchema.optional().describe('Desde esta fecha (YYYY-MM-DD), inclusive.'),
        date_to: isoDateSchema.optional().describe('Hasta esta fecha (YYYY-MM-DD), inclusive.'),
        payment_status: documentPaymentStatusSchema.optional(),
        finished: z.boolean().optional(),
        query: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe('Texto a buscar en el nombre del cliente o el folio.'),
        limit: z.number().int().min(1).max(100).optional().describe('1–100, predeterminado 25.'),
        cursor: z.string().min(1).max(200).optional().describe('next_cursor de la página anterior.'),
      }),
      outputSchema: listDocumentsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'list_documents',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => {
          const { company_id: _companyId, ...filters } = args;
          return listAgentDocuments(agent, filters);
        },
      ),
  );

  server.registerTool(
    'get_document',
    {
      title: 'Obtener documento',
      description:
        'Obtiene un ticket o presupuesto completo: líneas con materiales, notas de trabajo, folio, saldo, contacto del cliente y enlaces (app, pdf, share).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        document_id: documentIdSchema,
      }),
      outputSchema: getDocumentOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'get_document',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => ({
          document: await getAgentDocument(agent, parseDocumentId(args.document_id), {
            issuer: getOAuthIssuer((ctx as McpToolContext).http?.req),
          }),
        }),
      ),
  );

  server.registerTool(
    'get_company_summary',
    {
      title: 'Resumen de la compañía',
      description:
        'Resumen del día como en Inicio: trabajos de hoy y atrasados (primeros 10), por cobrar, saldo pendiente, conteo por estado de pago y presupuestos abiertos.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        date: isoDateSchema.optional().describe('Día a resumir (YYYY-MM-DD); predeterminado hoy.'),
      }),
      outputSchema: companySummaryOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'get_company_summary',
        ctx as McpToolContext,
        args,
        'tickets.read',
        'read',
        async (agent) => getAgentCompanySummary(agent, { date: args.date }),
      ),
  );
};
