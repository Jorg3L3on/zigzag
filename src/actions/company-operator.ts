'use server';

import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import { loadCompanyOperatorSummary } from '@/lib/company-operator-summary-loader';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

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
