/**
 * Background handler for company data exports. Builds the export bundle, uploads
 * it to Vercel Blob, and creates an in-app "export ready" notification with the
 * download URL. Runs off the request path via the job queue.
 */
import { put } from '@vercel/blob';
import { notification } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildCompanyExportBundle,
  serializeCompanyExportBundle,
} from '@/lib/company-export';
import { emitRealtimeEvent } from '@/lib/realtime/events';

export type CompanyExportJobPayload = {
  companyId: number;
  requestedByUserId?: string | null;
};

export const runCompanyExportJob = async (
  payload: Record<string, unknown>,
): Promise<void> => {
  const companyId = Number(payload.companyId);
  if (!Number.isInteger(companyId)) {
    throw new Error('company_export: invalid companyId');
  }
  const requestedByUserId =
    payload.requestedByUserId != null ? String(payload.requestedByUserId) : null;

  const bundle = await buildCompanyExportBundle(companyId);
  if (!bundle) {
    throw new Error(`company_export: company ${companyId} not found`);
  }

  const body = serializeCompanyExportBundle(bundle);
  const datePart = bundle.generated_at.slice(0, 10);
  const pathname = `exports/company-${companyId}/zigzag-export-${datePart}.json`;

  const blob = await put(pathname, body, {
    access: 'public',
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: true,
  });

  await db.insert(notification).values({
    company_id: companyId,
    user_id: requestedByUserId ? BigInt(requestedByUserId) : null,
    type: 'export_ready',
    title: 'Exportación lista',
    body: 'La exportación de datos de la empresa está disponible para descargar.',
    resource_type: 'company_export',
    resource_id: blob.url,
  });

  await emitRealtimeEvent({
    type: 'export_ready',
    companyId,
    resourceType: 'company_export',
    resourceId: blob.url,
  });
};
