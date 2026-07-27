/**
 * CSV column headers for import/export. Kept in a plain module (not a
 * 'use server' action file, which may only export async functions) so both
 * server actions and client components can import them.
 */

export const CLIENT_CSV_HEADERS = [
  'name',
  'email',
  'phone',
  'document',
] as const;

/** @deprecated Prefer importing from `@/lib/service-csv` (Spanish canonical). */
export { SERVICE_CSV_HEADERS } from '@/lib/service-csv';

export const TICKET_CSV_HEADERS = [
  'id',
  'cliente',
  'telefono',
  'email',
  'fecha',
  'total',
  'pagado',
  'saldo',
  'estado',
  'finalizado',
] as const;
