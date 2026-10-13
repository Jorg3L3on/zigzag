'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import {
  getCompanyPaymentInfo as pickPaymentInfo,
  type CompanyPaymentInfo,
} from '@/lib/company-payment-info';
import { db } from '@/lib/db';
import { handleCodedServerActionError, type ActionErrorType } from '@/lib/errors';
import { requireTicketRead } from '@/lib/tickets-rbac-server';

/**
 * Datos para pagar por transferencia of the caller's company (ZIG-I20-1), for
 * the WhatsApp cobranza and recibo messages. Scoped like a ticket read: a
 * tenant only ever gets its own company; a system operator passes the selected
 * company. Null data when the company set nothing.
 */
export async function getCompanyPaymentInfo(companyId?: number | null): Promise<{
  success: boolean;
  data?: CompanyPaymentInfo | null;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(companyId ?? undefined);
    const row = await db.query.company.findFirst({
      where: and(eq(company.id, effectiveCompanyId), isNull(company.deleted_at)),
      columns: { settings: true },
    });
    return { success: true, data: pickPaymentInfo(row?.settings) };
  } catch (e) {
    return handleCodedServerActionError('company.payment-info', 'CO002', e);
  }
}
