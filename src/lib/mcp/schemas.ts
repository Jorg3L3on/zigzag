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

/** One payment method per company (ZIG-23). `kind` is absent when settings have no payment_kind (legacy CLABE). */
export const companyPaymentInfoSchema = z.object({
  bank: z.string().nullable(),
  holder: z.string().nullable(),
  clabe: z.string().nullable(),
  note: z.string().nullable(),
  kind: z.enum(['clabe', 'card', 'account']).optional(),
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

/* Catalog and client read (ZIG-I23-4). Phase 5 (search/fetch) reuses these. */

/** Opaque keyset cursor (base64 of `created_at,id`), see `src/lib/mcp/cursor.ts`. */
export const cursorSchema = z
  .string()
  .min(1)
  .max(200)
  .describe('Cursor opaco de paginación: el next_cursor de la respuesta anterior.');

export const nextCursorSchema = z
  .string()
  .nullable()
  .describe('Pásalo como cursor para la siguiente página; null si no hay más.');

export const listLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .describe('Máximo de resultados por página (1-100, 50 por defecto).');

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe('Texto a buscar (no distingue mayúsculas).');

export const materialSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  unit: z.string().nullable().describe('Unidad corta: pza, m, kg, lt, hr.'),
  price: z.number().describe('Precio de catálogo por unidad.'),
});

export const serviceDefaultMaterialSchema = z.object({
  material_id: z.number().int(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
  price: z
    .number()
    .describe('Precio por unidad para este servicio (el de catálogo si no tiene uno propio).'),
});

export const serviceSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  default_materials: z.array(serviceDefaultMaterialSchema),
});

/* ------------------------------------------------------------------------- */
/* Documents (ZIG-I23-3): tickets and presupuestos over Ticket.document_kind  */
/* ------------------------------------------------------------------------- */

export const documentKindSchema = z.enum(['ticket', 'presupuesto']);

/** Payment status as the app labels it (Pendiente, Pago parcial, Pagado). */
export const documentPaymentStatusSchema = z.enum(['pendiente', 'parcial', 'pagado']);

export const presupuestoStatusSchema = z.enum([
  'abierto',
  'vencido',
  'convertido',
  'cancelado',
]);

export const documentFolioSchema = z.object({
  prefix: z.string().nullable(),
  number: z.number().int().nullable(),
  label: z.string().describe('Folio como se imprime, p. ej. R-0012 (o #id sin folio).'),
});

export const documentUrlsSchema = z.object({
  app: z.string().describe('Documento en la app de ZigZag (requiere sesión).'),
  pdf: z.string().describe('Vista del PDF en la app (requiere sesión).'),
  share: z
    .string()
    .nullable()
    .describe('Enlace público para el cliente; null cuando la app no ofrece uno.'),
});

/** One document in a list; phase 5 (search/fetch) reuses it. */
export const documentSummarySchema = ticketSummarySchema.extend({
  kind: documentKindSchema,
  folio: documentFolioSchema,
  payment_status: documentPaymentStatusSchema,
  balance: z.number().describe('Saldo por pagar (0 si está pagado).'),
  presupuesto_status: presupuestoStatusSchema
    .nullable()
    .describe('Solo presupuestos; null en tickets.'),
  updated_at: isoDateTimeSchema.nullable(),
});

export const documentLineSchema = z.object({
  id: z.number().int(),
  service_id: z.number().int().nullable(),
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
  subtotal: z.number().describe('cantidad × precio más los materiales de la línea.'),
  materials: z.array(ticketLineMaterialSchema),
});

export const documentClientSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});

export const documentDetailSchema = documentSummarySchema.extend({
  lines: z.array(documentLineSchema),
  work_notes: z.string().nullable(),
  source_presupuesto_folio: documentFolioSchema
    .nullable()
    .describe('Folio del presupuesto de origen cuando el ticket viene de una conversión.'),
  converted_to_document_id: z
    .string()
    .nullable()
    .describe('Ticket que resultó de convertir este presupuesto.'),
  client: documentClientSchema,
  created_by: z.object({ id: z.string(), name: z.string() }).nullable(),
  urls: documentUrlsSchema,
});

export const listDocumentsOutputSchema = z.object({
  documents: z.array(documentSummarySchema),
  next_cursor: z
    .string()
    .nullable()
    .describe('Pásalo como cursor para la siguiente página; null en la última.'),
});

export const getDocumentOutputSchema = z.object({ document: documentDetailSchema });

const paymentStatusBucketSchema = z.object({
  count: z.number().int(),
  amount: z.number(),
});

export const companySummaryOutputSchema = z.object({
  date: z.iso.date(),
  queue: z.object({
    counts: z.object({
      hoy: z.number().int(),
      atrasados: z.number().int(),
      por_cobrar: z.number().int(),
      recordatorios: z.number().int(),
    }),
    hoy: z.array(documentSummarySchema).describe('Primeros 10 trabajos de hoy.'),
    atrasados: z.array(documentSummarySchema).describe('Primeros 10 trabajos atrasados.'),
  }),
  por_cobrar_balance: z
    .number()
    .describe('Saldo de los trabajos terminados por cobrar (tarjeta Por cobrar de Inicio).'),
  pending_balance_total: z
    .number()
    .describe('Saldo pendiente de todos los tickets (KPI Saldo por cobrar del dashboard).'),
  active_tickets: z.number().int(),
  payment_status_counts: z.object({
    pendiente: paymentStatusBucketSchema,
    parcial: paymentStatusBucketSchema,
    pagado: paymentStatusBucketSchema,
  }),
  presupuestos_open: z.number().int(),
});

export const clientAddressSchema = z.object({
  street: z.string().nullable(),
  exterior_number: z.string().nullable(),
  interior_number: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  text: z.string().nullable().describe('Dirección en texto libre (campo anterior).'),
});

export const clientBalanceSchema = z.object({
  balance_due: z
    .number()
    .describe('Saldo pendiente: lo que deben los tickets terminados sin pagar.'),
  due_ticket_count: z.number().int(),
  ticket_count: z.number().int(),
});

export const clientDetailSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  document: z.string().nullable(),
  notes: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: clientAddressSchema,
  balance: clientBalanceSchema,
  recent_documents: z.array(documentSummarySchema),
  company_id: z.number().int().nullable(),
  created_at: isoDateTimeSchema,
});

export const listClientsOutputSchema = z.object({
  clients: z.array(clientSummarySchema),
  next_cursor: nextCursorSchema,
});

export const listServicesOutputSchema = z.object({
  services: z.array(serviceSchema),
  next_cursor: nextCursorSchema,
});

export const listMaterialsOutputSchema = z.object({
  materials: z.array(materialSchema),
  next_cursor: nextCursorSchema,
});

export const getClientOutputSchema = z.object({ client: clientDetailSchema });

/* ------------------------------------------------------------------------- */
/* search / fetch (ZIG-I23-5): OpenAI's company-knowledge shape               */
/* ------------------------------------------------------------------------- */

export const knowledgeIdSchema = z
  .string()
  .describe('Id opaco con tipo: doc:<id>, client:<id> o service:<id>.');

export const searchResultSchema = z.object({
  id: knowledgeIdSchema,
  title: z.string(),
  url: z.string().describe('URL absoluta en la app de ZigZag.'),
});

export const searchOutputSchema = z.object({
  results: z.array(searchResultSchema).max(20),
});

export const knowledgeMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const fetchOutputSchema = z.object({
  id: knowledgeIdSchema,
  title: z.string(),
  text: z.string().describe('El registro completo en texto legible (español).'),
  url: z.string(),
  metadata: knowledgeMetadataSchema,
});
