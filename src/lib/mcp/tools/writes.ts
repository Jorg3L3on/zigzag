import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getAgentClient } from '@/lib/mcp/domain/clients';
import { getAgentDocument } from '@/lib/mcp/domain/documents';
import {
  convertAgentPresupuesto,
  createAgentClient,
  createAgentDocument,
  updateAgentClient,
  updateAgentDocument,
} from '@/lib/mcp/domain/writes';
import {
  documentDetailSchema,
  getClientOutputSchema,
  getDocumentOutputSchema,
} from '@/lib/mcp/schemas';
import { parseAgentTicketId } from '@/lib/mcp/serialize-ticket';
import { documentIdSchema } from '@/lib/mcp/tools/documents';
import {
  companyIdSchema,
  McpToolError,
  runAgentCompanyTool,
  writeAnnotations,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { getOAuthIssuer } from '@/lib/server/mcp-oauth/config';

const isoDateSchema = z.iso.date();

const parseDocumentId = (value: string | number): bigint => {
  try {
    return parseAgentTicketId(value);
  } catch {
    throw new McpToolError('validation', 'document_id inválido');
  }
};

/* ------------------------------------------------------------------------- */
/* Input schemas                                                             */
/* ------------------------------------------------------------------------- */

const quantitySchema = z
  .number()
  .describe('0.01 a 9,999.99, máximo 2 decimales (ZIG-I12).');

const priceSchema = z.number().min(0).describe('Precio unitario en MXN.');

const materialInputSchema = z.object({
  material_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Material del catálogo (list_materials). Sin él, indica name.'),
  name: z.string().min(1).max(100).optional().describe('Material escrito a mano.'),
  quantity: quantitySchema,
  unit: z.string().max(20).optional().describe('Unidad del material escrito a mano (m, pza…).'),
  price: priceSchema,
});

const lineInputSchema = z.object({
  service_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Servicio del catálogo (list_services). Sin él, indica name.'),
  name: z.string().min(1).max(100).optional().describe('Línea escrita a mano.'),
  description: z.string().max(500).optional(),
  quantity: quantitySchema,
  price: priceSchema,
  materials: z.array(materialInputSchema).max(30).optional(),
});

const linesSchema = z
  .array(lineInputSchema)
  .min(1)
  .max(50)
  .describe('Al menos una línea. El total lo calcula el servidor: cantidad × precio más materiales.');

const documentClientInputSchema = z
  .object({
    client_id: z.number().int().positive().optional().describe('Cliente existente.'),
    name: z.string().min(1).max(100).optional().describe('Cliente nuevo: nombre.'),
    phone: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .describe('Cliente nuevo: teléfono (7 a 20 dígitos). Si ya existe un cliente con ese teléfono, se usa ese.'),
    email: z.string().email().max(100).optional(),
  })
  .describe('{ client_id } o { name, phone, email? }.');

const paymentSchema = z
  .union([
    z.enum(['pendiente', 'pagado']),
    z.object({ parcial: z.number().positive().describe('Monto pagado (MXN).') }),
  ])
  .describe(
    'Solo tickets. Si lo indicas, el ticket queda terminado (paso Listo) con ese pago: pendiente, pagado o { parcial: monto }. Sin payment el ticket queda en proceso y pendiente.',
  );

const clientAddressInputSchema = z.object({
  street: z.string().max(200).nullable().optional(),
  exterior_number: z.string().max(50).nullable().optional(),
  interior_number: z.string().max(50).nullable().optional(),
  neighborhood: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
});

const clientFieldsSchema = {
  email: z.string().email().max(100).nullable().optional(),
  document: z.string().max(100).nullable().optional().describe('RFC u otro documento.'),
  notes: z.string().max(2000).nullable().optional(),
  address: clientAddressInputSchema.optional(),
};

/* ------------------------------------------------------------------------- */
/* Output schemas                                                            */
/* ------------------------------------------------------------------------- */

export const createDocumentOutputSchema = z.object({
  document: documentDetailSchema,
  replayed: z
    .boolean()
    .describe('true cuando idempotency_key ya había creado este documento; no se creó otro.'),
});

const issuerOf = (ctx: McpToolContext) => getOAuthIssuer(ctx.http?.req);

/** Registers the ZIG-I23-6 write tools (all `write` scope). */
export const registerWriteTools = (server: McpServer) => {
  server.registerTool(
    'create_document',
    {
      title: 'Crear documento',
      description:
        'Crea un ticket (recibo) o un presupuesto con sus líneas y materiales, con las mismas reglas que el compositor de la app: folio siguiente de su tipo, total calculado por el servidor. Usa idempotency_key al reintentar para no crear dos documentos (vale 24 h por conexión). Devuelve el documento completo con sus enlaces.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        kind: z.enum(['ticket', 'presupuesto']),
        client: documentClientInputSchema,
        date: isoDateSchema.optional().describe('Fecha del documento (YYYY-MM-DD); predeterminado hoy.'),
        expires_at: isoDateSchema.optional().describe('Solo presupuestos: vigencia (YYYY-MM-DD).'),
        lines: linesSchema,
        work_notes: z.string().max(2000).optional(),
        payment: paymentSchema.optional(),
        idempotency_key: z
          .string()
          .min(8)
          .max(100)
          .optional()
          .describe('Clave única por intento lógico (p. ej. un UUID). Un reintento con la misma clave devuelve el primer documento.'),
      }),
      outputSchema: createDocumentOutputSchema,
      annotations: writeAnnotations({ idempotent: false }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'create_document',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'write',
        async (agent) => {
          const { company_id: _companyId, ...input } = args;
          const created = await createAgentDocument(agent, input);
          return {
            document: await getAgentDocument(agent, created.id, {
              issuer: issuerOf(ctx as McpToolContext),
            }),
            replayed: created.replayed,
          };
        },
      ),
  );

  server.registerTool(
    'update_document',
    {
      title: 'Editar documento',
      description:
        'Edita un ticket o presupuesto: cliente, fecha, líneas (reemplazo completo), notas de trabajo o terminado (solo tickets). Como en la app, no se puede editar un documento pagado por completo ni un presupuesto convertido o cancelado; el folio no cambia. Cliente y fecha solo cambian mientras el ticket está en proceso.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        document_id: documentIdSchema,
        client_id: z.number().int().positive().optional(),
        date: isoDateSchema.optional(),
        lines: linesSchema.optional(),
        work_notes: z.string().max(2000).optional(),
        finished: z
          .boolean()
          .optional()
          .describe('Solo tickets: true lo termina sin registrar pago; false lo reabre.'),
      }),
      outputSchema: getDocumentOutputSchema,
      annotations: writeAnnotations({ idempotent: true }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'update_document',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'write',
        async (agent) => {
          const { company_id: _companyId, document_id, ...input } = args;
          const id = await updateAgentDocument(agent, {
            ...input,
            document_id: parseDocumentId(document_id),
          });
          return {
            document: await getAgentDocument(agent, id, { issuer: issuerOf(ctx as McpToolContext) }),
          };
        },
      ),
  );

  server.registerTool(
    'convert_presupuesto',
    {
      title: 'Convertir presupuesto en ticket',
      description:
        'Convierte un presupuesto vigente en un ticket nuevo con folio de recibo, las mismas líneas y materiales. Devuelve el ticket nuevo (source_presupuesto_folio indica el presupuesto de origen).',
      inputSchema: z.object({
        company_id: companyIdSchema,
        document_id: documentIdSchema.describe('Id del presupuesto.'),
      }),
      outputSchema: getDocumentOutputSchema,
      annotations: writeAnnotations({ idempotent: false }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'convert_presupuesto',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'write',
        async (agent) => {
          const id = await convertAgentPresupuesto(agent, parseDocumentId(args.document_id));
          return {
            document: await getAgentDocument(agent, id, { issuer: issuerOf(ctx as McpToolContext) }),
          };
        },
      ),
  );

  server.registerTool(
    'create_client',
    {
      title: 'Crear cliente',
      description:
        'Crea un cliente en la compañía. El teléfono (7 a 20 dígitos) no puede repetirse: si ya existe, el error trae el client_id existente.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        name: z.string().min(1).max(100),
        phone: z.string().min(1).max(40),
        ...clientFieldsSchema,
      }),
      outputSchema: getClientOutputSchema,
      annotations: writeAnnotations({ idempotent: false }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'create_client',
        ctx as McpToolContext,
        args,
        'clients.write',
        'write',
        async (agent) => {
          const { company_id: _companyId, ...input } = args;
          const id = await createAgentClient(agent, input);
          return { client: await getAgentClient(agent, id) };
        },
      ),
  );

  server.registerTool(
    'update_client',
    {
      title: 'Editar cliente',
      description:
        'Cambia los campos indicados de un cliente (los demás quedan igual). Un teléfono que ya usa otro cliente se rechaza con su client_id.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        client_id: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        phone: z.string().min(1).max(40).optional(),
        ...clientFieldsSchema,
      }),
      outputSchema: getClientOutputSchema,
      annotations: writeAnnotations({ idempotent: true }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'update_client',
        ctx as McpToolContext,
        args,
        'clients.write',
        'write',
        async (agent) => {
          const { company_id: _companyId, client_id, ...input } = args;
          const id = await updateAgentClient(agent, client_id, input);
          return { client: await getAgentClient(agent, id) };
        },
      ),
  );
};
