import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';
import { captureException } from '@/lib/observability';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return ok({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    captureException(error, { route: '/api/health' });
    return fail('No se pudo verificar el estado del sistema', 503, 'server');
  }
}
