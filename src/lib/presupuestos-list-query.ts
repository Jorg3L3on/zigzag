import { sql, type SQL } from 'drizzle-orm';

import { ticket } from '@/db/schema';
import { COMPANY_TIME_ZONE } from '@/lib/company-day';
import type { PresupuestoStatus } from '@/lib/ticket-document-kind';

/**
 * The civil day of `expires_at` in the company zone. The column is a UTC wall
 * clock (timestamp without time zone), so it reads as UTC first.
 */
const expiresCompanyDay = sql`((${ticket.expires_at} AT TIME ZONE 'UTC') AT TIME ZONE ${COMPANY_TIME_ZONE})::date`;

/**
 * getPresupuestoStatus in SQL (ZIG-I29-3): canceled, then converted, then
 * expired when the expiry day is before the company's today, else open.
 * `todayIso` is `companyDay(new Date()).iso`.
 */
export const presupuestoStatusCondition = (
  status: PresupuestoStatus,
  todayIso: string,
): SQL => {
  const expired = sql`${ticket.expires_at} IS NOT NULL AND ${expiresCompanyDay} < ${todayIso}::date`;
  switch (status) {
    case 'cancelado':
      return sql`${ticket.canceled_at} IS NOT NULL`;
    case 'convertido':
      return sql`${ticket.canceled_at} IS NULL AND ${ticket.converted_to_ticket_id} IS NOT NULL`;
    case 'vencido':
      return sql`${ticket.canceled_at} IS NULL AND ${ticket.converted_to_ticket_id} IS NULL AND ${expired}`;
    case 'abierto':
      return sql`${ticket.canceled_at} IS NULL AND ${ticket.converted_to_ticket_id} IS NULL AND NOT (${expired})`;
  }
};

/** Open quotes whose expiry day is the company's today. */
export const presupuestoExpiresTodayCondition = (todayIso: string): SQL =>
  sql`${presupuestoStatusCondition('abierto', todayIso)} AND ${ticket.expires_at} IS NOT NULL AND ${expiresCompanyDay} = ${todayIso}::date`;
