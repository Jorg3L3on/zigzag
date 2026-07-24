import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';
import { captureException } from '@/lib/observability';
import {
  REQUEST_ID_HEADER,
  bindRequestIdFromRequest,
} from '@/lib/request-context';

/**
 * Liveness/readiness probe. Verifies the database is reachable and reports
 * whether dependent services (Vercel Blob) are configured. Returns 503 when the
 * database check fails so uptime monitors and Vercel can react.
 *
 * Echoes `x-request-id` in the JSON body for smoke-test traceability.
 */
export async function GET(request: Request) {
  const requestId = bindRequestIdFromRequest(request);
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

  try {
    await db.execute(sql`SELECT 1`);
    const response = ok({
      status: 'ok',
      database: 'ok',
      blob: blobConfigured ? 'configured' : 'not_configured',
      requestId,
      timestamp: new Date().toISOString(),
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    captureException(error, { route: '/api/health', requestId });
    const response = fail('No se pudo verificar el estado del sistema', 503, 'server');
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
