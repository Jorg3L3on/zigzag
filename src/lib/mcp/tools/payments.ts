import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getAgentDocument } from '@/lib/mcp/domain/documents';
import { PAYMENT_METHODS, registerAgentPayment } from '@/lib/mcp/domain/payments';
import { documentDetailSchema } from '@/lib/mcp/schemas';
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

export const registerPaymentOutputSchema = z.object({
  document: documentDetailSchema,
  replayed: z
    .boolean()
    .describe('true cuando idempotency_key ya había registrado este pago; no se registró otro.'),
});

const parseDocumentId = (value: string | number): bigint => {
  try {
    return parseAgentTicketId(value);
  } catch {
    throw new McpToolError('validation', 'document_id inválido');
  }
};

const amountSchema = z
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'Usa máximo 2 decimales',
  })
  .describe('Monto cobrado en MXN; mayor a 0 y no mayor al saldo por pagar.');

/** Registers register_payment (ZIG-I23-7): only for connections with the `payments` scope. */
export const registerPaymentTools = (server: McpServer) => {
  server.registerTool(
    'register_payment',
    {
      title: 'Registrar pago',
      description:
        'Registra un cobro en un ticket terminado, como Registrar cobro en la app: suma al pagado y actualiza el estado de pago. Requiere el scope payments (se concede aparte, apagado por defecto). El monto no puede pasar del saldo; no hay reembolsos ni borrado de pagos. Pide confirmación a la persona antes de llamarla. Usa idempotency_key al reintentar.',
      inputSchema: z.object({
        company_id: companyIdSchema,
        document_id: documentIdSchema.describe('Id del ticket (no presupuesto).'),
        amount: amountSchema,
        method: z
          .enum(PAYMENT_METHODS)
          .optional()
          .describe('Cómo pagó el cliente; queda en la auditoría.'),
        note: z.string().max(500).optional().describe('Nota para la auditoría.'),
        idempotency_key: z
          .string()
          .min(8)
          .max(100)
          .optional()
          .describe('Clave única por cobro (p. ej. un UUID). Un reintento con la misma clave no cobra dos veces.'),
      }),
      outputSchema: registerPaymentOutputSchema,
      // Money moves and the agent cannot undo it: clients ask before calling.
      annotations: writeAnnotations({ idempotent: false, destructive: true }),
    },
    async (args, ctx) =>
      runAgentCompanyTool(
        'register_payment',
        ctx as McpToolContext,
        args,
        'tickets.write',
        'payments',
        async (agent) => {
          const { company_id: _companyId, document_id, ...input } = args;
          const result = await registerAgentPayment(agent, {
            ...input,
            document_id: parseDocumentId(document_id),
          });
          return {
            document: await getAgentDocument(agent, result.id, {
              issuer: getOAuthIssuer((ctx as McpToolContext).http?.req),
            }),
            replayed: result.replayed,
          };
        },
      ),
  );
};
