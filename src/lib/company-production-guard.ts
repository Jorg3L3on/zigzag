import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import {
  assessCompanyReadiness,
  companyProductionBlockedMessage,
} from '@/lib/company-readiness';
import { AppError } from '@/lib/errors';

export class CompanyProductionBlockedError extends AppError {
  constructor(message: string) {
    super(message, 403, true, 'CO008');
  }
}

export const assertCompanyProductionReady = async (
  companyId: number,
): Promise<void> => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });

  if (!row) {
    throw new CompanyProductionBlockedError(
      'La empresa no existe o no está disponible.',
    );
  }

  const assessment = assessCompanyReadiness(row);
  if (!assessment.productionReady) {
    const message = companyProductionBlockedMessage(assessment);
    throw new CompanyProductionBlockedError(
      message || 'La empresa no está lista para operar.',
    );
  }
};
