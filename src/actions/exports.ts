'use server';

import { requireActionPermission } from '@/lib/security';
import { requireSystemUser } from '@/lib/authz-context';
import { enqueueJob } from '@/lib/jobs/queue';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';

/**
 * Request a company data export in the background. System operators only.
 * Returns immediately with a job id; the export is generated off the request
 * path and the requester receives an in-app "export ready" notification with
 * the download URL when it completes.
 */
export async function requestCompanyExport(companyId: number): Promise<{
  success: boolean;
  data?: { jobId: number };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context } = await requireActionPermission(
      'companies.read',
      companyId,
    );
    requireSystemUser(context);

    const jobId = await enqueueJob('company_export', {
      companyId,
      requestedByUserId: context.userId,
    });

    return { success: true, data: { jobId } };
  } catch (error) {
    return handleCodedServerActionError('exports.company', 'CO012', error);
  }
}
