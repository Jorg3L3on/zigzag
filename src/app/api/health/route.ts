import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return ok({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH_CHECK]', error);
    return fail('No se pudo verificar el estado del sistema', 503, 'server');
  }
}
