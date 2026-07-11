'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import {
  client,
  clientServiceSchedule,
  company,
  service,
  servicesTickets,
  ticket,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { assessCompanyReadiness } from '@/lib/company-readiness';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { checkPermission } from '@/lib/security';
import type { OnboardingChecklistSignals } from '@/lib/company-onboarding-checklist';

export type OnboardingStatusData = OnboardingChecklistSignals;

export type OnboardingStatusResponse = {
  success: boolean;
  data?: OnboardingStatusData;
  error?: string;
  errorType?: ActionErrorType;
};

export type FetchOnboardingStatusInput = {
  /** When the user is a system admin, load status for this company. */
  companyId?: number;
};

export async function loadOnboardingStatusForCompany(
  companyId: number,
): Promise<OnboardingStatusResponse> {
  try {
    const [companyRow] = await db
      .select()
      .from(company)
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .limit(1);

    if (!companyRow) {
      return buildActionError('CO006');
    }

    const readiness = assessCompanyReadiness(companyRow);
    const ticketScope = and(
      eq(ticket.company_id, companyId),
      isNull(ticket.deleted_at),
    );

    const [clientsAgg] = await db
      .select({ totalClients: sql<number>`count(*)` })
      .from(client)
      .where(and(eq(client.company_id, companyId), isNull(client.deleted_at)));

    const [servicesAgg] = await db
      .select({ totalServices: sql<number>`count(*)` })
      .from(service)
      .where(and(eq(service.company_id, companyId), isNull(service.deleted_at)));

    const [ticketAgg] = await db
      .select({
        totalTickets: sql<number>`count(*)`,
        finishedTicketCount: sql<number>`count(*) filter (where ${ticket.finished})`,
        hasPaidOrFinishedTicket: sql<number>`count(*) filter (where ${ticket.finished} or ${ticket.paid} > 0)`,
      })
      .from(ticket)
      .where(ticketScope);

    const [servicesSoldAgg] = await db
      .select({
        totalServicesSold: sql<number>`COALESCE(SUM(${servicesTickets.quantity}), 0)`,
      })
      .from(servicesTickets)
      .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
      .where(
        and(
          eq(ticket.company_id, companyId),
          isNull(ticket.deleted_at),
          isNull(servicesTickets.deleted_at),
        ),
      );

    const [usersAgg] = await db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(user)
      .where(and(eq(user.company_id, companyId), isNull(user.deleted_at)));

    const [schedulesAgg] = await db
      .select({ totalServiceSchedules: sql<number>`count(*)` })
      .from(clientServiceSchedule)
      .where(
        and(
          eq(clientServiceSchedule.company_id, companyId),
          isNull(clientServiceSchedule.deleted_at),
        ),
      );

    return {
      success: true,
      data: {
        profileReady: readiness.profileReady,
        totalClients: Number(clientsAgg?.totalClients ?? 0),
        totalServices: Number(servicesAgg?.totalServices ?? 0),
        totalTickets: Number(ticketAgg?.totalTickets ?? 0),
        totalServicesSold: Number(servicesSoldAgg?.totalServicesSold ?? 0),
        hasPaidOrFinishedTicket:
          Number(ticketAgg?.hasPaidOrFinishedTicket ?? 0) > 0,
        finishedTicketCount: Number(ticketAgg?.finishedTicketCount ?? 0),
        totalUsers: Number(usersAgg?.totalUsers ?? 0),
        totalServiceSchedules: Number(schedulesAgg?.totalServiceSchedules ?? 0),
        dismissedAt: companyRow.settings?.onboarding_checklist_dismissed_at ?? null,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('onboarding.status', 'CO001', error);
  }
}

export async function fetchOnboardingStatus(
  input: FetchOnboardingStatusInput = {},
): Promise<OnboardingStatusResponse> {
  const session = await auth();
  if (!session?.user?.company_id) {
    return buildActionError('AU001');
  }

  if (
    !session.user.company_is_system &&
    input.companyId != null &&
    input.companyId !== session.user.company_id
  ) {
    return buildActionError('AU002');
  }

  let effectiveCompanyId = session.user.company_id;
  if (session.user.company_is_system && input.companyId != null) {
    effectiveCompanyId = input.companyId;
  }

  const allowed = await checkPermission(
    session.user.id,
    effectiveCompanyId,
    'tickets.read',
  );

  if (!allowed) {
    return buildActionError('AU002');
  }

  return loadOnboardingStatusForCompany(effectiveCompanyId);
}
