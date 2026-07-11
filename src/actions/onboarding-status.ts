'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { client, company, service } from '@/db/schema';
import { db } from '@/lib/db';
import {
  assessCompanyReadiness,
} from '@/lib/company-readiness';
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

    const [clientsAgg] = await db
      .select({ totalClients: sql<number>`count(*)` })
      .from(client)
      .where(and(eq(client.company_id, companyId), isNull(client.deleted_at)));

    const [servicesAgg] = await db
      .select({ totalServices: sql<number>`count(*)` })
      .from(service)
      .where(and(eq(service.company_id, companyId), isNull(service.deleted_at)));

    return {
      success: true,
      data: {
        profileReady: readiness.profileReady,
        totalClients: Number(clientsAgg?.totalClients ?? 0),
        totalServices: Number(servicesAgg?.totalServices ?? 0),
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
