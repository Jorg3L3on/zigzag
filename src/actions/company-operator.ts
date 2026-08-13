'use server';

import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import { loadCompanyOperatorFleet } from '@/lib/company-operator-fleet-loader';
import { loadCompanyOperatorSummary } from '@/lib/company-operator-summary-loader';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { buildActionError } from '@/lib/errors';

export async function getCompanyOperatorSummary(companyId: number): Promise<{
  success: boolean;
  data?: CompanyOperatorSummary;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await requireActionPermission('companies.read', companyId);

    const summary = await loadCompanyOperatorSummary(companyId);
    if (!summary) {
      return buildActionError('CO006');
    }

    return { success: true, data: summary };
  } catch (error) {
    return handleCodedServerActionError(
      'companies.operator-summary',
      'CO002',
      error,
    );
  }
}

export async function getOperatorCompanyFleet(): Promise<{
  success: boolean;
  data?: OperatorFleetRow[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);
    await requireActionPermission('companies.read', authContext.companyId);

    const fleet = await loadCompanyOperatorFleet();
    return { success: true, data: fleet };
  } catch (error) {
    return handleCodedServerActionError(
      'companies.operator-fleet',
      'CO001',
      error,
    );
  }
}
