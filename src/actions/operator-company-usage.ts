'use server';

import { and, eq, gte, inArray, isNull, lt, max, sql } from 'drizzle-orm';
import { auditEvent, role, ticket, ticketPayment, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  sortPeopleBySignIn,
  USAGE_WINDOW_DAYS,
  type OperatorCompanyUsage,
} from '@/lib/operator-company-usage';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resumen › Uso and Personas (ZIG-I38-4): people with role and last sign-in,
 * active people, tickets created and payments recorded in the last 7 days
 * against the 7 before. Every query is keyed by the company and bounded by
 * the 14-day window.
 */
export async function fetchOperatorCompanyUsage(companyId: number): Promise<{
  success: boolean;
  data?: OperatorCompanyUsage;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    if (!Number.isInteger(companyId) || companyId < 1) {
      return buildActionError('CO006');
    }
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await requireActionPermission('users.read', companyId);

    const now = new Date();
    const weekStart = new Date(now.getTime() - USAGE_WINDOW_DAYS * DAY_MS);
    const previousStart = new Date(now.getTime() - 2 * USAGE_WINDOW_DAYS * DAY_MS);

    const people = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
        roleName: role.name,
      })
      .from(user)
      .leftJoin(role, eq(role.id, user.role_id))
      .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)));

    const ids = people.map((person) => person.id);

    const [signIns, activeRows, ticketRows, paymentRows] = await Promise.all([
      ids.length
        ? db
            .select({ userId: auditEvent.actor_user_id, at: max(auditEvent.occurred_at) })
            .from(auditEvent)
            .where(and(eq(auditEvent.action, 'signed_in'), inArray(auditEvent.actor_user_id, ids)))
            .groupBy(auditEvent.actor_user_id)
        : Promise.resolve([]),
      ids.length
        ? db
            .select({ total: sql<number>`count(distinct ${auditEvent.actor_user_id})::int` })
            .from(auditEvent)
            .where(
              and(
                eq(auditEvent.action, 'signed_in'),
                inArray(auditEvent.actor_user_id, ids),
                gte(auditEvent.occurred_at, weekStart),
              ),
            )
        : Promise.resolve([{ total: 0 }]),
      db
        .select({
          current: sql<number>`count(*) filter (where ${ticket.created_at} >= ${weekStart})::int`,
          previous: sql<number>`count(*) filter (where ${ticket.created_at} < ${weekStart})::int`,
        })
        .from(ticket)
        .where(
          and(
            eq(ticket.company_id, companyId),
            eq(ticket.document_kind, 'ticket'),
            isNull(ticket.deleted_at),
            gte(ticket.created_at, previousStart),
          ),
        ),
      db
        .select({
          current: sql<number>`count(*) filter (where ${ticketPayment.created_at} >= ${weekStart})::int`,
          previous: sql<number>`count(*) filter (where ${ticketPayment.created_at} < ${weekStart})::int`,
        })
        .from(ticketPayment)
        .where(
          and(
            eq(ticketPayment.company_id, companyId),
            gte(ticketPayment.created_at, previousStart),
            lt(ticketPayment.created_at, now),
          ),
        ),
    ]);

    const lastByUser = new Map<string, Date>();
    for (const row of signIns) {
      if (row.userId != null && row.at) lastByUser.set(String(row.userId), row.at);
    }

    const rows = sortPeopleBySignIn(
      people.map((person) => ({
        id: String(person.id),
        name: person.name,
        email: person.email,
        roleName: person.roleName ?? null,
        createdAt: person.createdAt.toISOString(),
        lastSignedInAt: lastByUser.get(String(person.id))?.toISOString() ?? null,
      })),
    );
    const latest = rows.find((person) => person.lastSignedInAt);

    return {
      success: true,
      data: {
        people: rows,
        lastSignIn: latest?.lastSignedInAt
          ? { at: latest.lastSignedInAt, name: latest.name }
          : null,
        activePeople: Number(activeRows[0]?.total ?? 0),
        ticketsCreated: {
          current: Number(ticketRows[0]?.current ?? 0),
          previous: Number(ticketRows[0]?.previous ?? 0),
        },
        paymentsRecorded: {
          current: Number(paymentRows[0]?.current ?? 0),
          previous: Number(paymentRows[0]?.previous ?? 0),
        },
      },
    };
  } catch (error) {
    return handleCodedServerActionError('operator.company-usage', 'CO002', error);
  }
}

