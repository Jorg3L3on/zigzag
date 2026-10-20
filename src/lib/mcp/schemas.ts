import { z } from 'zod';

/**
 * Shared zod schemas for the MCP tool contract (ZIG-I23-2).
 *
 * Every tool declares an `outputSchema` built from these pieces. They describe
 * the JSON a tool returns *after* `toolResult` normalises it: BigInt ids are
 * strings, dates are ISO 8601 strings, money is a number.
 */

/** ISO 8601 timestamp, as `Date#toJSON` writes it. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const MCP_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'rate_limited',
  'internal',
] as const;

export const errorCodeSchema = z.enum(MCP_ERROR_CODES);

export type McpErrorCode = z.infer<typeof errorCodeSchema>;

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const errorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    issues: z.array(validationIssueSchema).optional(),
  }),
});

export const companySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  status: z.enum(['SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'INACTIVE']),
});

export const ticketSummarySchema = z.object({
  id: z.string().describe('Id del ticket (BigInt serializado como string).'),
  client_id: z.number().int().nullable(),
  client_name: z.string().nullable(),
  ticket_date: isoDateTimeSchema.nullable(),
  total: z.number().nullable(),
  paid: z.number().nullable(),
  finished: z.boolean(),
  company_id: z.number().int().nullable(),
  created_at: isoDateTimeSchema,
});

export const ticketLineMaterialSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
  price: z.number(),
});

export const ticketLineSchema = z.object({
  id: z.number().int(),
  service_id: z.number().int().nullable(),
  name: z.string().nullable().optional(),
  quantity: z.number(),
  price: z.number(),
  materials: z.array(ticketLineMaterialSchema),
});

export const ticketDetailSchema = ticketSummarySchema.extend({
  services_tickets: z.array(ticketLineSchema),
});

export const clientSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().nullable(),
  document: z.string().nullable(),
  company_id: z.number().int().nullable(),
  created_at: isoDateTimeSchema,
});

export const authSourceSchema = z.enum(['api_key', 'oauth_grant']);

export const whoamiSchema = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  auth_source: authSourceSchema,
  connection_label: z.string().nullable(),
  scopes: z.array(z.enum(['read', 'write'])),
  companies: z.array(companySchema),
});

/* Output schemas of the v1 tools (plus whoami). */

export const listCompaniesOutputSchema = z.object({
  companies: z.array(companySchema),
});

export const listTicketsOutputSchema = z.object({
  tickets: z.array(ticketSummarySchema),
});

export const getTicketOutputSchema = z.object({ ticket: ticketDetailSchema });

export const ticketWriteOutputSchema = z.object({ ticket: ticketSummarySchema });

export const listClientsOutputSchema = z.object({
  clients: z.array(clientSummarySchema),
});
