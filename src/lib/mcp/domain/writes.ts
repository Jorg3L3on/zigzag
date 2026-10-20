/**
 * MCP write domain (ZIG-I23-6): create_document, update_document,
 * create_client, update_client and convert_presupuesto. Documents go through
 * the app's own server paths in `src/lib/documents/` (folio allocator, ZIG-I12
 * composer validation, recordTicketAudit); every write audits as `source: api`
 * with `mcp: { tool, connection }` so Auditoría shows it came from an agent.
 */
import crypto from 'node:crypto';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { client, ticket, ticketAuditEvent, user, type ClientRow } from '@/db/schema';
import type { ActionAuthContext } from '@/lib/authz-context';
import { invalidateCompanyCache } from '@/lib/cache';
import { CLIENT_NAME_MAX_LENGTH } from '@/lib/client-limits';
import { CompanyProductionBlockedError, assertCompanyProductionReady } from '@/lib/company-production-guard';
import { db } from '@/lib/db';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import {
  convertPresupuesto,
  PresupuestoNotConvertibleError,
  PresupuestoNotFoundError,
} from '@/lib/documents/convert-presupuesto';
import { createDocumentWithLines } from '@/lib/documents/create-document';
import {
  EmptyTicketFinishError,
  FinishPaidExceedsTotalError,
  finishTicketInTx,
  paidAmountForChoice,
  TicketAlreadyFinishedError,
  type FinishPaymentChoice,
} from '@/lib/documents/finish-ticket';
import {
  assertTicketNotFullyPaid,
  PresupuestoMutationBlockedError,
  replaceDocumentLines,
  TicketAlreadyPaidError,
  TotalBelowPaidError,
  updateDocumentFields,
} from '@/lib/documents/update-document';
import { AuthorizationError, TicketTotalCapError } from '@/lib/errors';
import { getOwnedConnection } from '@/lib/mcp/activity';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import { recordResourceAudit } from '@/lib/resource-audit';
import { recordTicketAudit } from '@/lib/ticket-audit';

import { isWorkTicket } from '@/lib/ticket-document-kind';
import { composerServiceLineSchema } from '@/lib/ticket-service-line-schema';
import type { AgentContext } from '@/lib/server/resolve-agent-context';

export const IDEMPOTENCY_WINDOW_HOURS = 24;
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 20;

/* ------------------------------------------------------------------------- */
/* Actor, connection and audit                                               */
/* ------------------------------------------------------------------------- */

export type AgentConnection = {
  kind: 'api_key' | 'oauth_grant';
  id: number;
  name: string | null;
};

type WriteAgent = Pick<
  AgentContext,
  'userId' | 'companyId' | 'authSource' | 'apiKeyId' | 'oauthGrantId'
>;

/** The connection the call came through, with its display name. */
export const resolveAgentConnection = async (agent: WriteAgent): Promise<AgentConnection> => {
  const kind = agent.authSource;
  const id = (kind === 'api_key' ? agent.apiKeyId : agent.oauthGrantId) ?? 0;
  const owned = id > 0 ? await getOwnedConnection(agent.userId, kind, id) : null;
  return { kind, id, name: owned?.name ?? null };
};

/** The agent's user as an audit actor (own company, system flag). */
export const resolveAgentActor = async (agent: WriteAgent): Promise<ActionAuthContext> => {
  const userRow = await db.query.user.findFirst({
    where: eq(user.id, agent.userId),
    columns: { company_id: true },
    with: { company: { columns: { is_system: true } } },
  });
  return {
    userId: String(agent.userId),
    companyId: userRow?.company_id ?? agent.companyId,
    companyIsSystem: userRow?.company?.is_system ?? false,
  };
};

export type McpAuditInfo = {
  tool: string;
  connection: AgentConnection;
  idempotency_key?: string;
  document_id?: string;
};

export const mcpAuditExtra = (info: McpAuditInfo) => ({ mcp: info });

type WriteSession = {
  actor: ActionAuthContext;
  connection: AgentConnection;
  audit: (extra?: Partial<McpAuditInfo>) => {
    source: string;
    extra: Record<string, unknown>;
    via: 'api';
  };
};

const startWrite = async (agent: WriteAgent, tool: string): Promise<WriteSession> => {
  const [actor, connection] = await Promise.all([
    resolveAgentActor(agent),
    resolveAgentConnection(agent),
  ]);
  return {
    actor,
    connection,
    audit: (extra = {}) => ({
      source: 'mcp',
      extra: mcpAuditExtra({ tool, connection, ...extra }),
      via: 'api',
    }),
  };
};

const afterDocumentWrite = (companyId: number, documentId?: bigint) => {
  invalidateCompanyCache(companyId, 'dashboard');
  try {
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath('/presupuestos');
    if (documentId != null) revalidatePath(`/tickets/${String(documentId)}`);
  } catch {
    // Outside a Next request (tests, scripts) there is nothing to revalidate.
  }
};

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

const AUTHORIZATION_MESSAGES: Record<string, McpToolError> = {
  'Client not found for this company': new McpToolError(
    'not_found',
    'Cliente no encontrado en esta compañía',
  ),
  'One or more services are unavailable': new McpToolError(
    'validation',
    'Algún service_id no existe en esta compañía. Consulta list_services.',
  ),
  'One or more materials are unavailable': new McpToolError(
    'validation',
    'Algún material_id no existe en esta compañía. Consulta list_materials.',
  ),
  'Ticket not found': new McpToolError('not_found', 'Documento no encontrado'),
  'Access denied to this ticket': new McpToolError('not_found', 'Documento no encontrado'),
};

const formatPesos = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Maps the app's document errors to coded tool errors with Spanish messages. */
export const toMcpWriteError = (error: unknown): unknown => {
  if (error instanceof McpToolError || error instanceof z.ZodError) return error;
  if (error instanceof AuthorizationError && AUTHORIZATION_MESSAGES[error.message]) {
    return AUTHORIZATION_MESSAGES[error.message];
  }
  if (error instanceof TicketAlreadyPaidError) {
    return new McpToolError('validation', 'El documento ya está pagado por completo; no se puede editar.');
  }
  if (error instanceof PresupuestoMutationBlockedError || error instanceof PresupuestoNotConvertibleError) {
    return new McpToolError(
      'validation',
      'El presupuesto ya se convirtió o se canceló; no se puede modificar.',
    );
  }
  if (error instanceof PresupuestoNotFoundError) {
    return new McpToolError('not_found', 'Presupuesto no encontrado');
  }
  if (error instanceof TotalBelowPaidError) {
    return new McpToolError(
      'validation',
      `El total no puede quedar abajo de lo ya pagado (${formatPesos(error.paid)}).`,
    );
  }
  if (error instanceof TicketTotalCapError) {
    return new McpToolError('validation', 'El total del documento excede el máximo permitido.');
  }
  if (error instanceof FinishPaidExceedsTotalError) {
    return new McpToolError('validation', 'El pago no puede ser mayor al total del ticket.');
  }
  if (error instanceof EmptyTicketFinishError) {
    return new McpToolError('validation', 'No se puede terminar un ticket sin líneas.');
  }
  if (error instanceof TicketAlreadyFinishedError) {
    return new McpToolError('validation', 'El ticket ya está terminado.');
  }
  if (error instanceof CompanyProductionBlockedError) {
    return new McpToolError('forbidden', error.message);
  }
  return error;
};

const mapErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw toMcpWriteError(error);
  }
};

/* ------------------------------------------------------------------------- */
/* Input mapping                                                             */
/* ------------------------------------------------------------------------- */

export type AgentMaterialInput = {
  material_id?: number;
  name?: string;
  quantity: number;
  unit?: string;
  price: number;
};

export type AgentLineInput = {
  service_id?: number;
  name?: string;
  description?: string;
  quantity: number;
  price: number;
  materials?: AgentMaterialInput[];
};

const composerLinesSchema = z.array(composerServiceLineSchema).min(1).max(50);

/** Agent lines → the composer's parsed lines (ZIG-I12 limits apply). */
export const toComposerLines = (lines: AgentLineInput[]) => {
  const mapped = lines.map((line, index) => {
    const materials = (line.materials ?? []).map((material, materialIndex) => {
      if (material.material_id != null) {
        return {
          kind: 'catalog' as const,
          material_id: material.material_id,
          quantity: material.quantity,
          price: material.price,
        };
      }
      if (material.name) {
        return {
          kind: 'custom' as const,
          name: material.name,
          unit: material.unit ?? null,
          quantity: material.quantity,
          price: material.price,
        };
      }
      throw new McpToolError(
        'validation',
        `lines.${index}.materials.${materialIndex}: indica material_id o name.`,
      );
    });
    if (line.service_id != null) {
      return {
        kind: 'catalog' as const,
        service_id: line.service_id,
        quantity: line.quantity,
        price: line.price,
        materials,
      };
    }
    if (line.name) {
      return {
        kind: 'custom' as const,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        price: line.price,
        materials,
      };
    }
    throw new McpToolError('validation', `lines.${index}: indica service_id o name.`);
  });
  return composerLinesSchema.parse(mapped);
};

export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    throw new McpToolError(
      'validation',
      `El teléfono debe tener entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} dígitos.`,
    );
  }
  return digits;
};

const findClientByPhone = async (
  companyId: number,
  digits: string,
  exceptId?: number,
): Promise<ClientRow | undefined> =>
  db.query.client.findFirst({
    where: and(
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
      sql`regexp_replace(coalesce(${client.phone}, ''), '\\D', '', 'g') = ${digits}`,
      exceptId != null ? ne(client.id, exceptId) : undefined,
    ),
  });

/* ------------------------------------------------------------------------- */
/* Clients                                                                   */
/* ------------------------------------------------------------------------- */

export type AgentClientInput = {
  name?: string;
  phone?: string;
  email?: string | null;
  document?: string | null;
  notes?: string | null;
  address?: {
    street?: string | null;
    exterior_number?: string | null;
    interior_number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
};

const clientValues = (input: AgentClientInput) => {
  const address = input.address ?? {};
  const pick = <K extends keyof typeof address>(key: K) =>
    key in address ? { [key]: address[key] || null } : {};
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {}),
    ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
    ...(input.document !== undefined ? { document: input.document?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...pick('street'),
    ...pick('exterior_number'),
    ...pick('interior_number'),
    ...pick('neighborhood'),
    ...pick('city'),
    ...pick('state'),
    ...pick('postal_code'),
    ...pick('country'),
  };
};

const duplicatePhoneError = (existing: ClientRow) =>
  new McpToolError(
    'validation',
    `Ya existe un cliente con ese teléfono en esta compañía: client_id ${existing.id} (${existing.name}). Usa ese client_id o update_client.`,
  );

const insertAgentClient = async (
  session: WriteSession,
  companyId: number,
  input: AgentClientInput & { name: string; phone: string },
): Promise<ClientRow> => {
  const name = input.name.trim();
  if (!name || name.length > CLIENT_NAME_MAX_LENGTH) {
    throw new McpToolError(
      'validation',
      `El nombre es obligatorio y puede tener máximo ${CLIENT_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  const values = clientValues(input);
  const existing = await findClientByPhone(companyId, values.phone as string);
  if (existing) throw duplicatePhoneError(existing);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(client)
      .values({ ...values, name, company_id: companyId })
      .returning();
    await recordResourceAudit(tx, {
      actor: session.actor,
      resourceType: 'client',
      resourceId: created.id,
      targetCompanyId: companyId,
      action: 'created',
      after: created,
      source: 'api',
      extra: session.audit().extra,
    });
    return created;
  });
};

export const createAgentClient = async (
  agent: WriteAgent,
  input: AgentClientInput & { name: string; phone: string },
  tool = 'create_client',
): Promise<number> => {
  const session = await startWrite(agent, tool);
  const created = await insertAgentClient(session, agent.companyId, input);
  try {
    revalidatePath('/clients');
  } catch {
    // Outside a Next request.
  }
  return created.id;
};

export const updateAgentClient = async (
  agent: WriteAgent,
  clientId: number,
  input: AgentClientInput,
): Promise<number> => {
  const existing = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, agent.companyId),
      isNull(client.deleted_at),
    ),
  });
  if (!existing) throw new McpToolError('not_found', 'Cliente no encontrado');

  if (input.name !== undefined) {
    const name = input.name.trim();
    // Names saved before the cap stay as they are; a changed name must fit (ZIG-I12).
    if (!name || (name.length > CLIENT_NAME_MAX_LENGTH && name !== existing.name)) {
      throw new McpToolError(
        'validation',
        `El nombre es obligatorio y puede tener máximo ${CLIENT_NAME_MAX_LENGTH} caracteres.`,
      );
    }
  }
  const values = clientValues(input);
  if (Object.keys(values).length === 0) {
    throw new McpToolError('validation', 'Indica al menos un campo a cambiar.');
  }
  if (values.phone) {
    const duplicate = await findClientByPhone(agent.companyId, values.phone as string, clientId);
    if (duplicate) throw duplicatePhoneError(duplicate);
  }

  const session = await startWrite(agent, 'update_client');
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(client)
      .set({ ...values, updated_at: new Date() })
      .where(
        and(
          eq(client.id, clientId),
          eq(client.company_id, agent.companyId),
          isNull(client.deleted_at),
        ),
      )
      .returning();
    await recordResourceAudit(tx, {
      actor: session.actor,
      resourceType: 'client',
      resourceId: clientId,
      targetCompanyId: agent.companyId,
      action: 'updated',
      before: existing,
      after: updated,
      source: 'api',
      extra: session.audit().extra,
    });
  });
  try {
    revalidatePath('/clients');
  } catch {
    // Outside a Next request.
  }
  return clientId;
};

/** `{ client_id }` must be live in this company; `{ name, phone }` reuses a client with that phone or creates one. */
const resolveDocumentClient = async (
  session: WriteSession,
  companyId: number,
  input: { client_id?: number; name?: string; phone?: string; email?: string },
): Promise<number> => {
  if (input.client_id != null) return input.client_id;
  if (!input.name || !input.phone) {
    throw new McpToolError(
      'validation',
      'client necesita client_id, o name y phone para un cliente nuevo.',
    );
  }
  const digits = normalizePhone(input.phone);
  const existing = await findClientByPhone(companyId, digits);
  if (existing) return existing.id;
  const created = await insertAgentClient(session, companyId, {
    name: input.name,
    phone: digits,
    email: input.email ?? null,
  });
  return created.id;
};

/* ------------------------------------------------------------------------- */
/* Documents                                                                 */
/* ------------------------------------------------------------------------- */

/** Fold a connection + key into the 32-bit advisory lock key space. */
const idempotencyLockKey = (connection: AgentConnection, key: string): number =>
  crypto
    .createHash('sha256')
    .update(`${connection.kind}:${connection.id}:${key}`)
    .digest()
    .readInt32BE(0);

/**
 * The document a previous create_document with this key created through this
 * connection in the last 24 h. The key lives in the `created` audit payload,
 * written in the same transaction as the document.
 */
const findIdempotentDocument = async (
  tx: Pick<typeof db, 'select'>,
  companyId: number,
  connection: AgentConnection,
  key: string,
): Promise<bigint | null> => {
  const [row] = await tx
    .select({ ticket_id: ticketAuditEvent.ticket_id })
    .from(ticketAuditEvent)
    .where(
      and(
        eq(ticketAuditEvent.company_id, companyId),
        eq(ticketAuditEvent.event_type, 'created'),
        sql`${ticketAuditEvent.created_at} > now() - make_interval(hours => ${IDEMPOTENCY_WINDOW_HOURS})`,
        sql`${ticketAuditEvent.payload} -> 'mcp' ->> 'idempotency_key' = ${key}`,
        sql`${ticketAuditEvent.payload} -> 'mcp' -> 'connection' ->> 'kind' = ${connection.kind}`,
        sql`${ticketAuditEvent.payload} -> 'mcp' -> 'connection' ->> 'id' = ${String(connection.id)}`,
      ),
    )
    .limit(1);
  return row?.ticket_id ?? null;
};

export type CreateDocumentArgs = {
  kind: 'ticket' | 'presupuesto';
  client: { client_id?: number; name?: string; phone?: string; email?: string };
  date?: string;
  expires_at?: string;
  lines: AgentLineInput[];
  work_notes?: string;
  payment?: FinishPaymentChoice;
  idempotency_key?: string;
};

const parseDay = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const day = new Date(`${value}T12:00:00`);
  if (Number.isNaN(day.getTime())) throw new McpToolError('validation', `Fecha inválida: ${value}`);
  return day;
};

export const createAgentDocument = async (
  agent: WriteAgent,
  args: CreateDocumentArgs,
): Promise<{ id: bigint; replayed: boolean }> =>
  mapErrors(async () => {
    if (args.kind === 'presupuesto' && args.payment !== undefined) {
      throw new McpToolError('validation', 'payment solo aplica a tickets.');
    }
    if (args.kind === 'ticket' && args.expires_at !== undefined) {
      throw new McpToolError('validation', 'expires_at solo aplica a presupuestos.');
    }
    const lines = toComposerLines(args.lines);
    await assertCompanyProductionReady(agent.companyId);

    const session = await startWrite(agent, 'create_document');
    const key = args.idempotency_key;

    // A replay must not create a client either: look the key up first.
    if (key) {
      const existing = await findIdempotentDocument(db, agent.companyId, session.connection, key);
      if (existing != null) return { id: existing, replayed: true };
    }

    const clientId = await resolveDocumentClient(session, agent.companyId, args.client);
    const payment = args.payment;

    const created = await createDocumentWithLines(session.actor, {
      companyId: agent.companyId,
      kind: args.kind,
      clientId,
      ticketDate: parseDay(args.date) ?? new Date(),
      expiresAt: parseDay(args.expires_at) ?? null,
      workNotes: args.work_notes ?? '',
      lines,
      audit: session.audit(key ? { idempotency_key: key } : {}),
      beforeInsert: key
        ? async (tx) => {
            await acquireAdvisoryLock(
              tx,
              ADVISORY_LOCK_NAMESPACE.mcpIdempotency,
              idempotencyLockKey(session.connection, key),
            );
            return findIdempotentDocument(tx, agent.companyId, session.connection, key);
          }
        : undefined,
      afterInsert:
        args.kind === 'ticket' && payment !== undefined
          ? async (tx, row) => {
              if (typeof payment === 'object' && payment.parcial > row.total) {
                throw new FinishPaidExceedsTotalError();
              }
              await finishTicketInTx(tx, session.actor, {
                ticketId: row.id,
                companyId: agent.companyId,
                paid: (total) => paidAmountForChoice(payment, total),
                prior: row,
                auditExtra: session.audit().extra,
                via: 'api',
              });
            }
          : undefined,
    });

    afterDocumentWrite(agent.companyId, created.id);
    return { id: created.id, replayed: created.replayed };
  });

export type UpdateDocumentArgs = {
  document_id: bigint;
  client_id?: number;
  date?: string;
  lines?: AgentLineInput[];
  work_notes?: string;
  finished?: boolean;
};

const loadDocument = async (companyId: number, documentId: bigint) => {
  const row = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, documentId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)),
  });
  if (!row) throw new McpToolError('not_found', 'Documento no encontrado');
  return row;
};

export const updateAgentDocument = async (
  agent: WriteAgent,
  args: UpdateDocumentArgs,
): Promise<bigint> =>
  mapErrors(async () => {
    const changesContent =
      args.client_id !== undefined ||
      args.date !== undefined ||
      args.lines !== undefined ||
      args.work_notes !== undefined;
    if (!changesContent && args.finished === undefined) {
      throw new McpToolError('validation', 'Indica al menos un campo a cambiar.');
    }

    const prior = await loadDocument(agent.companyId, args.document_id);
    if (args.finished !== undefined && !isWorkTicket(prior.document_kind)) {
      throw new McpToolError('validation', 'finished solo aplica a tickets.');
    }
    const lines = args.lines ? toComposerLines(args.lines) : undefined;
    const session = await startWrite(agent, 'update_document');
    const audit = session.audit({ document_id: String(args.document_id) });

    if (changesContent) {
      const common = {
        companyId: agent.companyId,
        documentId: args.document_id,
        clientId: args.client_id,
        ticketDate: parseDay(args.date),
        workNotes: args.work_notes,
        audit,
      };
      if (lines) {
        await replaceDocumentLines(session.actor, { ...common, lines });
      } else {
        await updateDocumentFields(session.actor, common);
      }
    } else {
      // A finished-only change still follows the paid rule, like the app.
      await assertTicketNotFullyPaid(args.document_id, agent.companyId);
    }

    if (args.finished !== undefined) {
      const current = await loadDocument(agent.companyId, args.document_id);
      if (args.finished && !current.finished) {
        // Terminar without recording a payment (the listo step's "pendiente").
        await db.transaction((tx) =>
          finishTicketInTx(tx, session.actor, {
            ticketId: args.document_id,
            companyId: agent.companyId,
            paid: current.paid ?? 0,
            prior: current,
            auditExtra: audit.extra,
            via: 'api',
          }),
        );
      } else if (!args.finished && current.finished) {
        await db.transaction(async (tx) => {
          const [row] = await tx
            .update(ticket)
            .set({ finished: false, updated_at: new Date() })
            .where(
              and(
                eq(ticket.id, args.document_id),
                eq(ticket.company_id, agent.companyId),
                isNull(ticket.deleted_at),
              ),
            )
            .returning();
          await recordTicketAudit(
            tx,
            session.actor,
            args.document_id,
            agent.companyId,
            'updated',
            { before: current, after: row, statusChanged: true, finished: false, ...audit.extra },
            'api',
          );
        });
      }
    }

    afterDocumentWrite(agent.companyId, args.document_id);
    return args.document_id;
  });

export const convertAgentPresupuesto = async (
  agent: WriteAgent,
  presupuestoId: bigint,
): Promise<bigint> =>
  mapErrors(async () => {
    const session = await startWrite(agent, 'convert_presupuesto');
    const { workTicket } = await convertPresupuesto(session.actor, {
      companyId: agent.companyId,
      presupuestoId,
      audit: {
        extra: session.audit({ document_id: String(presupuestoId) }).extra,
        via: 'api',
      },
    });
    afterDocumentWrite(agent.companyId, workTicket.id);
    return workTicket.id;
  });
