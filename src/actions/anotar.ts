'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  client,
  service,
  servicesTickets,
  ticket,
  ticketPayment,
  type TicketRow,
} from '@/db/schema';
import { AnotarCaptureInput } from '@/lib/anotar-capture';
import { invalidateCompanyCache } from '@/lib/cache';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import { db } from '@/lib/db';
import {
  AuthenticationError,
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  handleServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { AMOUNT_TOLERANCE } from '@/lib/ticket-payment-status';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

const TRABAJO_SERVICE_NAME = 'Trabajo';

type PgError = {
  code?: string;
  constraint?: string;
};

class FinishPaidExceedsTotalError extends Error {
  constructor() {
    super('Paid amount exceeds ticket total');
    this.name = 'FinishPaidExceedsTotalError';
  }
}

const isTicketPrimaryKeyConflict = (error: unknown): boolean => {
  const dbError = (error as { cause?: PgError })?.cause;
  return (
    dbError?.code === '23505' &&
    (dbError?.constraint === 'Ticket_pkey' || dbError?.constraint === 'ticket_pkey')
  );
};

const syncTicketIdSequence = async (): Promise<void> => {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"Ticket"', 'id'),
      COALESCE((SELECT MAX("id") FROM "Ticket"), 0) + 1,
      false
    );
  `);
};

const assertClientBelongsToCompany = async (
  clientId: number | undefined,
  companyId: number,
): Promise<void> => {
  if (clientId == null) {
    return;
  }

  const clientRow = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
    ),
    columns: { id: true },
  });

  if (!clientRow) {
    throw new AuthorizationError('Client not found for this company');
  }
};

type TicketMutationExecutor = Parameters<typeof syncTicketTotal>[0];

const resolveCaptureServiceId = async (
  tx: TicketMutationExecutor & {
    query: typeof db.query;
    insert: typeof db.insert;
  },
  companyId: number,
  linePrice: number,
): Promise<number> => {
  const byName = await tx.query.service.findFirst({
    where: and(
      eq(service.company_id, companyId),
      eq(service.name, TRABAJO_SERVICE_NAME),
      isNull(service.deleted_at),
    ),
    columns: { id: true },
  });
  if (byName) {
    return byName.id;
  }

  const firstAvailable = await tx.query.service.findFirst({
    where: and(eq(service.company_id, companyId), isNull(service.deleted_at)),
    columns: { id: true },
    orderBy: [asc(service.created_at)],
  });
  if (firstAvailable) {
    return firstAvailable.id;
  }

  const [created] = await tx
    .insert(service)
    .values({
      name: TRABAJO_SERVICE_NAME,
      description: 'Servicio genérico para captura rápida',
      price: linePrice,
      company_id: companyId,
    })
    .returning({ id: service.id });

  return created.id;
};

const runAnotarCaptureTransaction = async (
  validated: z.infer<typeof AnotarCaptureInput>,
  context: Awaited<ReturnType<typeof requireTicketWrite>>['context'],
  effectiveCompanyId: number,
): Promise<TicketRow> => {
  const paidAmount = roundMoney(validated.paid);
  const linePrice = roundMoney(validated.total);
  const ticketDate = validated.ticket_date ?? new Date();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({
        client_id: validated.client_id,
        client_name: validated.client_name,
        client_tel: validated.client_tel,
        work_notes: validated.work_notes || null,
        ticket_date: ticketDate,
        company_id: effectiveCompanyId,
        userId: BigInt(context.userId),
        document_kind: 'ticket',
        finished: false,
        paid: 0,
        total: 0,
      })
      .returning();

    const ticketId = created.id;
    const serviceId = await resolveCaptureServiceId(
      tx as TicketMutationExecutor & {
        query: typeof db.query;
        insert: typeof db.insert;
      },
      effectiveCompanyId,
      linePrice,
    );

    await tx.insert(servicesTickets).values({
      service_id: serviceId,
      ticket_id: ticketId,
      quantity: 1,
      price: linePrice,
    });

    const totalAmount = await syncTicketTotal(tx, ticketId);

    if (paidAmount - totalAmount > AMOUNT_TOLERANCE) {
      throw new FinishPaidExceedsTotalError();
    }

    await acquireAdvisoryLock(
      tx,
      ADVISORY_LOCK_NAMESPACE.ticketFinish,
      ticketId,
    );

    const [finishedRow] = await tx
      .update(ticket)
      .set({
        finished: true,
        total: totalAmount,
        paid: paidAmount,
      })
      .where(
        and(
          eq(ticket.id, ticketId),
          eq(ticket.company_id, effectiveCompanyId),
          isNull(ticket.deleted_at),
          eq(ticket.finished, false),
        ),
      )
      .returning();

    if (!finishedRow) {
      throw new Error('ANOTAR_FINISH_RACE');
    }

    if (paidAmount > AMOUNT_TOLERANCE) {
      await tx.insert(ticketPayment).values({
        ticket_id: ticketId,
        amount: paidAmount,
        company_id: finishedRow.company_id,
      });
    }

    await recordTicketAudit(
      tx,
      context,
      ticketId,
      effectiveCompanyId,
      'created',
      {
        ticket: created,
        source: 'anotar',
      },
    );

    await recordTicketAudit(
      tx,
      context,
      ticketId,
      effectiveCompanyId,
      'finished',
      {
        before: created,
        after: finishedRow,
        initialPayment: paidAmount > AMOUNT_TOLERANCE ? paidAmount : 0,
        syncedTotal: totalAmount,
        ignoredClientTotal: validated.total,
        source: 'anotar',
      },
    );

    return finishedRow;
  });
};

export async function anotarCapture(
  input: z.input<typeof AnotarCaptureInput>,
): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const validated = AnotarCaptureInput.parse(input);
    const { context, companyId: effectiveCompanyId } = await requireTicketWrite(
      validated.company_id,
    );

    await assertClientBelongsToCompany(validated.client_id, effectiveCompanyId);

    let created: TicketRow;
    try {
      created = await runAnotarCaptureTransaction(
        validated,
        context,
        effectiveCompanyId,
      );
    } catch (error) {
      if (!isTicketPrimaryKeyConflict(error)) {
        throw error;
      }
      await syncTicketIdSequence();
      created = await runAnotarCaptureTransaction(
        validated,
        context,
        effectiveCompanyId,
      );
    }

    invalidateCompanyCache(effectiveCompanyId, 'dashboard');
    revalidatePath('/dashboard');
    revalidatePath('/tickets');
    revalidatePath('/cobranza');
    revalidatePath(`/tickets/${String(created.id)}`);

    return {
      success: true,
      data: { id: String(created.id) },
    };
  } catch (error) {
    if (error instanceof FinishPaidExceedsTotalError) {
      return buildActionError('TC009', undefined, 'validation');
    }
    if (error instanceof z.ZodError) {
      return handleCodedServerActionError(
        'anotar.validation',
        'TC009',
        error,
      );
    }
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return handleServerActionError(error);
    }
    return handleCodedServerActionError('anotar.capture', 'TC001', error);
  }
}
