import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';
import { captureException } from '@/lib/observability';

/**
 * Liveness/readiness probe. Verifies the database is reachable and reports
 * whether dependent services (Vercel Blob) are configured. Returns 503 when the
 * database check fails so uptime monitors and Vercel can react.
 */
export async function GET() {
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

  try {
    await db.execute(sql`SELECT 1`);
    return ok({
      status: 'ok',
      database: 'ok',
      blob: blobConfigured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    captureException(error, { route: '/api/health' });
    return fail('No se pudo verificar el estado del sistema', 503, 'server');
  }
}
